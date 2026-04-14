import crypto from "node:crypto";
import { prisma } from "@workspace/database";
import type {
  Order,
  Side,
  Trade,
  Ticker,
  Fill,
  PlaceOrderInput,
  PlaceOrderResult,
  CancelOrderResult,
  UserBalance
} from "@workspace/types";
import { Orderbook } from "./Orderbook.js";

/**
 * A simplified matching engine that maintains orderbooks in memory.
 * It handles matching bids and asks, tracking balances, and calculating tickers.
 */
export class Engine {
  private orderbooks: Map<string, Orderbook>;
  private balances: Map<string, UserBalance>;
  private trades: Map<string, Trade[]>;

  constructor() {
    this.orderbooks = new Map();
    this.balances = new Map();
    this.trades = new Map();

    // Default market
    this.createMarket("TATA_INR");

    // Default balances for tests - will be replaced by DB loading in production
    this.deposit("1", "INR", 1_000_000);
    this.deposit("1", "TATA", 1_000);
    this.deposit("2", "INR", 1_000_000);
    this.deposit("2", "TATA", 1_000);
    this.deposit("5", "INR", 1_000_000);
    this.deposit("5", "TATA", 1_000);
  }

  createMarket(market: string) {
    if (this.orderbooks.has(market)) return;
    const [base, quote] = this.splitMarket(market);
    this.orderbooks.set(market, new Orderbook(base, quote));
    this.trades.set(market, []);
  }

  // --- BALANCE METHODS ---

  getBalances(userId: string): UserBalance {
    return this.balances.get(userId) || {};
  }

  async ensureUserLoaded(userId: string) {
    if (this.balances.has(userId)) return;
    
    let balances = await prisma.$queryRaw`
      SELECT * FROM "Balance"
      WHERE "userId" = ${userId}
    ` as any[];

    if (balances.length === 0) {
      const defaultAssets = ["TATA", "INR"];
      for (const asset of defaultAssets) {
        await prisma.$queryRaw`
          INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
          VALUES (gen_random_uuid(), ${userId}, ${asset}, '0', '0')
        `;
      }
      balances = await prisma.$queryRaw`
        SELECT * FROM "Balance"
        WHERE "userId" = ${userId}
      ` as any[];
    }

    const result: Record<string, { available: number; locked: number }> = {};
    for (const b of balances) {
      result[b.asset] = { available: Number(b.available), locked: Number(b.locked) };
    }
    this.balances.set(userId, result);
  }

  deposit(userId: string, asset: string, amount: number) {
    const user = this.getOrCreateUserBalance(userId);
    if (!user[asset]) user[asset] = { available: 0, locked: 0 };
    user[asset].available += amount;
  }

  // --- TRADING METHODS ---

  placeOrder(input: PlaceOrderInput): PlaceOrderResult {
    const { market, userId, side, price, quantity } = input;
    const orderbook = this.mustGetOrderbook(market);
    const [base, quote] = this.splitMarket(market);

    // Initial check and lock funds
    this.checkAndLockFunds(userId, base, quote, side, price, quantity);

    const order: Order = {
      orderId: crypto.randomUUID(),
      userId,
      side,
      price,
      quantity,
      filled: 0
    };

    // Run the matcher
    const { executedQty, fills } = orderbook.addOrder(order);

    // Update balances based on fills
    this.applyFills(userId, side, base, quote, fills);
    this.recordTrades(market, userId, side, fills);

    // Refund excess locked funds for buy orders if price was lower or order filled
    if (side === "buy") {
      this.releaseUnusedBuyFunds(userId, quote, price, quantity, executedQty, fills);
    }

    const status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" = executedQty === quantity ? "FILLED" : executedQty > 0 ? "PARTIALLY_FILLED" : "OPEN";
    
    return {
      orderId: order.orderId,
      executedQty,
      fills,
      status,
      remainingQty: quantity - executedQty
    };
  }

  cancelOrder(market: string, orderId: string): CancelOrderResult {
    const orderbook = this.mustGetOrderbook(market);
    const order = orderbook.cancel(orderId);

    if (!order) throw new Error("Order not found");

    const [base, quote] = this.splitMarket(market);
    const user = this.getOrCreateUserBalance(order.userId);
    const remaining = order.quantity - order.filled;

    if (order.side === "buy") {
      const refund = remaining * order.price;
      user[quote]!.locked -= refund;
      user[quote]!.available += refund;
    } else {
      user[base]!.locked -= remaining;
      user[base]!.available += remaining;
    }

    return {
      orderId,
      remainingQty: remaining,
      executedQty: order.filled
    };
  }

  // --- DATA RETRIEVAL ---

  getDepth(market: string) {
    return this.mustGetOrderbook(market).getDepth();
  }

  getOpenOrders(market: string, userId: string): Order[] {
    const orderbook = this.mustGetOrderbook(market);
    return [...orderbook.bids, ...orderbook.asks].filter(o => o.userId === userId);
  }

  getTrades(market: string): Trade[] {
    return this.trades.get(market) || [];
  }

  getTickers(): Ticker[] {
    return Array.from(this.orderbooks.keys()).map(market => this.getTicker(market));
  }

  getTicker(market: string): Ticker {
    const trades = this.trades.get(market) || [];
    if (trades.length === 0) {
      return { symbol: market, lastPrice: "0", high: "0", low: "0", volume: "0", quoteVolume: "0", firstPrice: "0", priceChange: "0", priceChangePercent: "0", trades: 0 };
    }

    const prices = trades.map(t => t.price);
    const lastPrice = prices[0]!;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = trades.reduce((sum, t) => sum + t.quantity, 0);
    const quoteVolume = trades.reduce((sum, t) => sum + (t.quantity * t.price), 0);

    return {
      symbol: market,
      lastPrice: lastPrice.toString(),
      high: high.toString(),
      low: low.toString(),
      volume: volume.toString(),
      quoteVolume: quoteVolume.toString(),
      firstPrice: prices[prices.length - 1]!.toString(),
      priceChange: (lastPrice - prices[prices.length - 1]!).toString(),
      priceChangePercent: ((lastPrice - prices[prices.length - 1]!) / prices[prices.length - 1]! * 100).toString(),
      trades: trades.length
    };
  }

  // --- PRIVATE HELPERS ---

  private applyFills(takerId: string, takerSide: Side, base: string, quote: string, fills: Fill[]) {
    const taker = this.getOrCreateUserBalance(takerId);

    for (const fill of fills) {
      const maker = this.getOrCreateUserBalance(fill.otherUserId);
      const cost = fill.qty * fill.price;

      if (takerSide === "buy") {
        taker[quote]!.locked -= cost;
        taker[base]!.available += fill.qty;
        maker[base]!.locked -= fill.qty;
        maker[quote]!.available += cost;
      } else {
        taker[base]!.locked -= fill.qty;
        taker[quote]!.available += cost;
        maker[quote]!.locked -= cost;
        maker[base]!.available += fill.qty;
      }
    }
  }

  private recordTrades(market: string, takerId: string, takerSide: Side, fills: Fill[]) {
    const marketTrades = this.trades.get(market)!;
    for (const fill of fills) {
      marketTrades.unshift({
        tradeId: fill.tradeId,
        market,
        price: fill.price,
        quantity: fill.qty,
        buyerUserId: takerSide === "buy" ? takerId : fill.otherUserId,
        sellerUserId: takerSide === "sell" ? takerId : fill.otherUserId,
        timestamp: Date.now()
      });
    }
    if (marketTrades.length > 100) marketTrades.pop();
  }

  private checkAndLockFunds(userId: string, base: string, quote: string, side: Side, price: number, quantity: number) {
    const user = this.getOrCreateUserBalance(userId);
    if (side === "buy") {
      const cost = price * quantity;
      if (!user[quote] || user[quote]!.available < cost) throw new Error("Insufficient quote balance");
      user[quote]!.available -= cost;
      user[quote]!.locked += cost;
    } else {
      if (!user[base] || user[base]!.available < quantity) throw new Error("Insufficient base balance");
      user[base]!.available -= quantity;
      user[base]!.locked += quantity;
    }
  }

  private releaseUnusedBuyFunds(userId: string, quote: string, price: number, quantity: number, executed: number, fills: Fill[]) {
    const user = this.getOrCreateUserBalance(userId);
    const locked = price * quantity;
    const spent = fills.reduce((s, f) => s + (f.price * f.qty), 0);
    const reserved = (quantity - executed) * price;
    const refund = locked - spent - reserved;
    if (refund > 0) {
      user[quote]!.locked -= refund;
      user[quote]!.available += refund;
    }
  }

  private mustGetOrderbook(market: string): Orderbook {
    const ob = this.orderbooks.get(market);
    if (!ob) throw new Error(`Market ${market} not found`);
    return ob;
  }

  private splitMarket(market: string): [string, string] {
    return market.split("_") as [string, string];
  }

  private getOrCreateUserBalance(userId: string): UserBalance {
    if (!this.balances.has(userId)) this.balances.set(userId, {});
    return this.balances.get(userId)!;
  }
}


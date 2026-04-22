import crypto from "node:crypto";
import * as database from "@workspace/database";
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

const prisma = database.prisma ?? database.default?.prisma;

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

    const mmMarkets = (process.env.MM_MARKETS || "TATA_INR")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    mmMarkets.forEach((m) => this.createMarket(m));

    // Default balances for tests - will be replaced by DB loading in production
    mmMarkets.forEach(m => {
      const [base, quote] = this.splitMarket(m);
      this.deposit("1", quote, 1_000_000);
      this.deposit("1", base, 1_000);
      this.deposit("2", quote, 1_000_000);
      this.deposit("2", base, 1_000);
    });
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
      const assets = new Set<string>();
      for (const market of this.orderbooks.keys()) {
        const [base, quote] = this.splitMarket(market);
        assets.add(base);
        assets.add(quote);
      }

      for (const asset of Array.from(assets)) {
        await prisma.$queryRaw`
          INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
          VALUES (gen_random_uuid(), ${userId}, ${asset}, '0', '0')
          ON CONFLICT DO NOTHING
        `;
      }
      balances = await prisma.$queryRaw`
        SELECT * FROM "Balance"
        WHERE "userId" = ${userId}
      ` as any[];
    }

    const result: Record<string, { available: number; locked: number }> = {};
    for (const b of balances) {
      result[b.asset] = { available: Number(b.available) || 0, locked: Number(b.locked) || 0 };
    }
    this.balances.set(userId, result);
  }

  deposit(userId: string, asset: string, amount: number) {
    const user = this.getOrCreateUserBalance(userId);
    if (!user[asset]) user[asset] = { available: 0, locked: 0 };
    user[asset].available = (Number(user[asset].available) || 0) + (Number(amount) || 0);
  }

  // --- TRADING METHODS ---

  placeOrder(input: PlaceOrderInput): PlaceOrderResult {
    const { market, userId, side, price, quantity } = input;
    const orderbook = this.mustGetOrderbook(market);
    const [base, quote] = this.splitMarket(market);

    // Initial check and lock funds
    this.checkAndLockFunds(userId, base, quote, side, Number(price), Number(quantity));

    const order: Order = {
      orderId: crypto.randomUUID(),
      userId,
      side,
      price: Number(price),
      quantity: Number(quantity),
      filled: 0
    };

    // Run the matcher
    const { executedQty, fills } = orderbook.addOrder(order);

    // Update balances based on fills
    this.applyFills(userId, side, base, quote, fills);
    this.recordTrades(market, userId, side, fills);

    // Refund excess locked funds for buy orders if price was lower or order filled
    if (side === "buy") {
      this.releaseUnusedBuyFunds(userId, quote, Number(price), Number(quantity), executedQty, fills);
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
    const remaining = Number(order.quantity) - Number(order.filled);

    if (order.side === "buy") {
      const refund = remaining * Number(order.price);
      user[quote]!.locked = (Number(user[quote]!.locked) || 0) - refund;
      user[quote]!.available = (Number(user[quote]!.available) || 0) + refund;
    } else {
      user[base]!.locked = (Number(user[base]!.locked) || 0) - remaining;
      user[base]!.available = (Number(user[base]!.available) || 0) + remaining;
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

    const prices = trades.map(t => Number(t.price));
    const lastPrice = prices[0]!;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = trades.reduce((sum, t) => sum + Number(t.quantity), 0);
    const quoteVolume = trades.reduce((sum, t) => sum + (Number(t.quantity) * Number(t.price)), 0);

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
      const cost = Number(fill.qty) * Number(fill.price);

      if (takerSide === "buy") {
        taker[quote]!.locked = (Number(taker[quote]!.locked) || 0) - cost;
        taker[base]!.available = (Number(taker[base]!.available) || 0) + Number(fill.qty);
        maker[base]!.locked = (Number(maker[base]!.locked) || 0) - Number(fill.qty);
        maker[quote]!.available = (Number(maker[quote]!.available) || 0) + cost;
      } else {
        taker[base]!.locked = (Number(taker[base]!.locked) || 0) - Number(fill.qty);
        taker[quote]!.available = (Number(taker[quote]!.available) || 0) + cost;
        maker[quote]!.locked = (Number(maker[quote]!.locked) || 0) - cost;
        maker[base]!.available = (Number(maker[base]!.available) || 0) + Number(fill.qty);
      }
    }
  }

  private recordTrades(market: string, takerId: string, takerSide: Side, fills: Fill[]) {
    const marketTrades = this.trades.get(market)!;
    for (const fill of fills) {
      marketTrades.unshift({
        tradeId: fill.tradeId,
        market,
        price: Number(fill.price),
        quantity: Number(fill.qty),
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
      const cost = Number(price) * Number(quantity);
      if (!user[quote] || (Number(user[quote]!.available) || 0) < cost) throw new Error("Insufficient quote balance");
      user[quote]!.available = (Number(user[quote]!.available) || 0) - cost;
      user[quote]!.locked = (Number(user[quote]!.locked) || 0) + cost;
    } else {
      if (!user[base] || (Number(user[base]!.available) || 0) < Number(quantity)) throw new Error("Insufficient base balance");
      user[base]!.available = (Number(user[base]!.available) || 0) - Number(quantity);
      user[base]!.locked = (Number(user[base]!.locked) || 0) + Number(quantity);
    }
  }

  private releaseUnusedBuyFunds(userId: string, quote: string, price: number, quantity: number, executed: number, fills: Fill[]) {
    const user = this.getOrCreateUserBalance(userId);
    const locked = Number(price) * Number(quantity);
    const spent = fills.reduce((s, f) => s + (Number(f.price) * Number(f.qty)), 0);
    const reserved = (Number(quantity) - Number(executed)) * Number(price);
    const refund = locked - spent - reserved;
    if (refund > 0) {
      user[quote]!.locked = (Number(user[quote]!.locked) || 0) - refund;
      user[quote]!.available = (Number(user[quote]!.available) || 0) + refund;
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

  async init() {
    const markets = Array.from(this.orderbooks.keys());
    for (const market of markets) {
      // Load last price from Trades
      const lastTrades = await prisma.$queryRaw`
        SELECT price FROM "Trade"
        WHERE market = ${market}
        ORDER BY timestamp DESC
        LIMIT 1
      ` as any[];
      
      if (lastTrades.length > 0) {
        const price = Number(lastTrades[0].price);
        this.trades.get(market)?.push({
          tradeId: 0,
          market,
          price,
          quantity: 0,
          buyerUserId: "system",
          sellerUserId: "system",
          timestamp: Date.now()
        });
      }
    }
  }

  private getOrCreateUserBalance(userId: string): UserBalance {
    if (!this.balances.has(userId)) this.balances.set(userId, {});
    return this.balances.get(userId)!;
  }
}

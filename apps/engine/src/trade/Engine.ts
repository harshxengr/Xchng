import crypto from "node:crypto";
import { 
  query,
  saveOrder,
  markOrderCancelled,
  upsertUserBalances,
  ensureAndLoadBalances
} from "@workspace/shared";
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
} from "@workspace/shared";

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
    const balances = await ensureAndLoadBalances(userId);
    this.balances.set(userId, balances);
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

    const status = executedQty === quantity ? "FILLED" : executedQty > 0 ? "PARTIALLY_FILLED" : "OPEN";
    
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
      user[quote].locked -= refund;
      user[quote].available += refund;
    } else {
      user[base].locked -= remaining;
      user[base].available += remaining;
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

    return {
      symbol: market,
      lastPrice: lastPrice.toString(),
      high: high.toString(),
      low: low.toString(),
      volume: volume.toString(),
      quoteVolume: (volume * lastPrice).toString(), // simplified
      firstPrice: prices[prices.length - 1]!.toString(),
      priceChange: (lastPrice - prices[prices.length - 1]!).toString(),
      priceChangePercent: "0",
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
        taker[quote].locked -= cost;
        taker[base].available += fill.qty;
        maker[base].locked -= fill.qty;
        maker[quote].available += cost;
      } else {
        taker[base].locked -= fill.qty;
        taker[quote].available += cost;
        maker[quote].locked -= cost;
        maker[base].available += fill.qty;
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
      if (!user[quote] || user[quote].available < cost) throw new Error("Insufficient quote balance");
      user[quote].available -= cost;
      user[quote].locked += cost;
    } else {
      if (!user[base] || user[base].available < quantity) throw new Error("Insufficient base balance");
      user[base].available -= quantity;
      user[base].locked += quantity;
    }
  }

  private releaseUnusedBuyFunds(userId: string, quote: string, price: number, quantity: number, executed: number, fills: Fill[]) {
    const user = this.getOrCreateUserBalance(userId);
    const locked = price * quantity;
    const spent = fills.reduce((s, f) => s + (f.price * f.qty), 0);
    const reserved = (quantity - executed) * price;
    const refund = locked - spent - reserved;
    if (refund > 0) {
      user[quote].locked -= refund;
      user[quote].available += refund;
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

/**
 * Inner class to handle logical order matching for one market.
 */
class Orderbook {
  public bids: Order[] = [];
  public asks: Order[] = [];
  private nextTradeId = 1;

  constructor(public base: string, public quote: string) {}

  addOrder(order: Order): { executedQty: number; fills: Fill[] } {
    return order.side === "buy" ? this.match(order, this.asks, true) : this.match(order, this.bids, false);
  }

  match(order: Order, opposites: Order[], isBuy: boolean): { executedQty: number; fills: Fill[] } {
    let executedQty = 0;
    const fills: Fill[] = [];

    // Sort opposites: for buy, asks should be lowest first. for sell, bids should be highest first.
    opposites.sort((a, b) => isBuy ? a.price - b.price : b.price - a.price);

    for (const opp of opposites) {
      if (executedQty >= order.quantity) break;
      if (isBuy ? opp.price > order.price : opp.price < order.price) break;

      const qty = Math.min(order.quantity - executedQty, opp.quantity - opp.filled);
      if (qty <= 0) continue;

      opp.filled += qty;
      executedQty += qty;

      fills.push({
        tradeId: this.nextTradeId++,
        orderId: order.orderId,
        price: opp.price,
        qty,
        otherUserId: opp.userId,
        makerOrderId: opp.orderId,
        makerFilledQuantity: opp.filled,
        makerStatus: opp.filled === opp.quantity ? "FILLED" : "PARTIALLY_FILLED"
      });
    }

    order.filled = executedQty;
    
    // Clean up filled orders from opposite book
    if (isBuy) {
      this.asks = this.asks.filter(o => o.filled < o.quantity);
      if (order.filled < order.quantity) this.bids.push(order);
    } else {
      this.bids = this.bids.filter(o => o.filled < o.quantity);
      if (order.filled < order.quantity) this.asks.push(order);
    }

    return { executedQty, fills };
  }

  cancel(orderId: string): Order | undefined {
    let idx = this.bids.findIndex(o => o.orderId === orderId);
    if (idx !== -1) return this.bids.splice(idx, 1)[0];
    idx = this.asks.findIndex(o => o.orderId === orderId);
    if (idx !== -1) return this.asks.splice(idx, 1)[0];
    return undefined;
  }

  getDepth() {
    const summarize = (orders: Order[]) => {
      const levels: Record<number, number> = {};
      for (const o of orders) levels[o.price] = (levels[o.price] || 0) + (o.quantity - o.filled);
      return Object.entries(levels).map(([p, q]) => [p, q.toString()] as [string, string]);
    };
    return {
      bids: summarize(this.bids).sort((a, b) => Number(b[0]) - Number(a[0])),
      asks: summarize(this.asks).sort((a, b) => Number(a[0]) - Number(b[0]))
    };
  }
}

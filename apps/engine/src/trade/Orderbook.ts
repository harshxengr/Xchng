import type { Order, Fill } from "@workspace/types";

export class Orderbook {
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

      // Self-trading prevention
      if (opp.userId === order.userId) continue;

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

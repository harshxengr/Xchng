export class Orderbook {
    baseAsset;
    quoteAsset;
    bids;
    asks;
    lastTradeId;
    constructor(baseAsset, quoteAsset) {
        this.baseAsset = baseAsset;
        this.quoteAsset = quoteAsset;
        this.bids = [];
        this.asks = [];
        this.lastTradeId = 1;
    }
    ticker() {
        return `${this.baseAsset}_${this.quoteAsset}`;
    }
    addOrder(order) {
        if (order.side === "buy") {
            return this.matchBuy(order);
        }
        return this.matchSell(order);
    }
    cancel(orderId) {
        const bidIndex = this.bids.findIndex((o) => o.orderId === orderId);
        if (bidIndex !== -1) {
            const [removed] = this.bids.splice(bidIndex, 1);
            return removed;
        }
        const askIndex = this.asks.findIndex((o) => o.orderId === orderId);
        if (askIndex !== -1) {
            const [removed] = this.asks.splice(askIndex, 1);
            return removed;
        }
        return undefined;
    }
    getOpenOrders(userId) {
        return [...this.bids, ...this.asks].filter((o) => o.userId === userId);
    }
    getDepth() {
        const bidLevels = new Map();
        const askLevels = new Map();
        for (const bid of this.bids) {
            const remaining = bid.quantity - bid.filled;
            if (remaining <= 0)
                continue;
            bidLevels.set(bid.price, (bidLevels.get(bid.price) ?? 0) + remaining);
        }
        for (const ask of this.asks) {
            const remaining = ask.quantity - ask.filled;
            if (remaining <= 0)
                continue;
            askLevels.set(ask.price, (askLevels.get(ask.price) ?? 0) + remaining);
        }
        const bids = Array.from(bidLevels.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([price, qty]) => [price.toString(), qty.toString()]);
        const asks = Array.from(askLevels.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([price, qty]) => [price.toString(), qty.toString()]);
        return { bids, asks };
    }
    matchBuy(order) {
        let executedQty = 0;
        const fills = [];
        for (const ask of this.asks) {
            if (executedQty >= order.quantity)
                break;
            if (ask.userId === order.userId)
                continue;
            if (ask.price > order.price)
                continue;
            const available = ask.quantity - ask.filled;
            if (available <= 0)
                continue;
            const qty = Math.min(order.quantity - executedQty, available);
            ask.filled += qty;
            executedQty += qty;
            fills.push({
                tradeId: this.lastTradeId++,
                price: ask.price,
                qty,
                otherUserId: ask.userId,
                makerOrderId: ask.orderId
            });
        }
        order.filled = executedQty;
        this.asks = this.asks.filter((o) => o.filled < o.quantity);
        if (order.filled < order.quantity) {
            this.bids.push(order);
        }
        return { executedQty, fills };
    }
    matchSell(order) {
        let executedQty = 0;
        const fills = [];
        for (const bid of this.bids) {
            if (executedQty >= order.quantity)
                break;
            if (bid.userId === order.userId)
                continue;
            if (bid.price < order.price)
                continue;
            const available = bid.quantity - bid.filled;
            if (available <= 0)
                continue;
            const qty = Math.min(order.quantity - executedQty, available);
            bid.filled += qty;
            executedQty += qty;
            fills.push({
                tradeId: this.lastTradeId++,
                price: bid.price,
                qty,
                otherUserId: bid.userId,
                makerOrderId: bid.orderId
            });
        }
        order.filled = executedQty;
        this.bids = this.bids.filter((o) => o.filled < o.quantity);
        if (order.filled < order.quantity) {
            this.asks.push(order);
        }
        return { executedQty, fills };
    }
}

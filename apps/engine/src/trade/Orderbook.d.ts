import type { Fill, Order } from "@workspace/types";
export declare class Orderbook {
    readonly baseAsset: string;
    readonly quoteAsset: string;
    bids: Order[];
    asks: Order[];
    private lastTradeId;
    constructor(baseAsset: string, quoteAsset: string);
    ticker(): string;
    addOrder(order: Order): {
        executedQty: number;
        fills: Fill[];
    };
    cancel(orderId: string): Order | undefined;
    getOpenOrders(userId: string): Order[];
    getDepth(): {
        bids: [string, string][];
        asks: [string, string][];
    };
    private matchBuy;
    private matchSell;
}
//# sourceMappingURL=Orderbook.d.ts.map
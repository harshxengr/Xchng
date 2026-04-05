import type { CancelOrderResult, Order, PlaceOrderInput, PlaceOrderResult, UserBalance } from "@workspace/types";
export declare class Engine {
    private orderbooks;
    private balances;
    constructor();
    createMarket(market: string): void;
    deposit(userId: string, asset: string, amount: number): void;
    getBalances(userId: string): UserBalance;
    placeOrder(input: PlaceOrderInput): PlaceOrderResult;
    cancelOrder(market: string, orderId: string): CancelOrderResult;
    getDepth(market: string): {
        bids: [string, string][];
        asks: [string, string][];
    };
    getOpenOrders(market: string, userId: string): Order[];
    private applyFills;
    private releaseUnusedBuyFunds;
    private checkAndLockFunds;
    private mustGetOrderbook;
    private splitMarket;
    private getOrCreateUserBalance;
    private getOrCreateAssetBalance;
}
//# sourceMappingURL=Engine.d.ts.map
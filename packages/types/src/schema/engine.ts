export type Side = "buy" | "sell";

export type Order = {
    orderId: string;
    userId: string;
    side: Side;
    price: number;
    quantity: number;
    filled: number;
};

export type Fill = {
    tradeId: number;
    price: number;
    qty: number;
    otherUserId: string;
    makerOrderId: string;
};

export type PlaceOrderInput = {
    market: string;
    userId: string;
    side: Side;
    price: number;
    quantity: number;
};

export type PlaceOrderResult = {
    orderId: string;
    executedQty: number;
    fills: Fill[];
};

export type CancelOrderResult = {
    orderId: string;
    remainingQty: number;
    executedQty: number;
};

export type Depth = {
    bids: [string, string][];
    asks: [string, string][];
};

export type AssetBalance = {
    available: number;
    locked: number;
};

export type UserBalance = Record<string, AssetBalance>;

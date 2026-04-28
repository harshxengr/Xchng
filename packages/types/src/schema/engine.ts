export type Side = "buy" | "sell";
export type OrderType = "limit" | "market";

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
    orderId: string;
    price: number;
    qty: number;
    otherUserId: string;
    makerOrderId: string;
    makerFilledQuantity: number;
    makerStatus: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
};

export type Trade = {
    tradeId: number;
    market: string;
    price: number;
    quantity: number;
    buyerUserId: string;
    sellerUserId: string;
    timestamp: number;
};

export type Ticker = {
    symbol: string;
    lastPrice: string;
    high: string;
    low: string;
    volume: string;
    quoteVolume: string;
    firstPrice: string;
    priceChange: string;
    priceChangePercent: string;
    trades: number;
};

export type PlaceOrderInput = {
    market: string;
    userId: string;
    side: Side;
    orderType?: OrderType;
    price: number;
    quantity: number;
};

export type PlaceOrderResult = {
    orderId: string;
    executedQty: number;
    fills: Fill[];
    status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
    remainingQty: number;
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

export type EngineCommand = {
    requestId: string;
    type: "PLACE_ORDER" | "CANCEL_ORDER" | "DEPOSIT";
    payload: any;
};

export type EngineCommandResult<T = any> = {
    requestId: string;
    ok: boolean;
    data?: T;
    error?: string;
};

export type EngineEvent = {
    type: string;
    market?: string;
    data: any;
};

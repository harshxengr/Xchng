export type PersistedTradeInput = {
    tradeId: number;
    market: string;
    price: number;
    quantity: number;
    buyerUserId: string;
    sellerUserId: string;
    timestamp: number;
};

export type PersistedTickerInput = {
    market: string;
    lastPrice: number;
    high: number;
    low: number;
    volume: number;
    quoteVolume: number;
    firstPrice: number;
    priceChange: number;
    priceChangePercent: number;
    trades: number;
    timestamp: number;
};


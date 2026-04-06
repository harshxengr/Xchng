export type DepthPayload = {
    type: "depth";
    symbol: string;
    data: {
        bids: [string, string][];
        asks: [string, string][];
    };
};

export type TradePayload = {
    type: "trade";
    symbol: string;
    data: {
        tradeId: number;
        market: string;
        price: number;
        quantity: number;
        buyerUserId: string;
        sellerUserId: string;
        timestamp: number;
    };
};

export type TickerPayload = {
    type: "ticker";
    symbol: string;
    data: {
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
};

export type ServerMessage = DepthPayload | TradePayload | TickerPayload;

export type ClientMessage =
    | {
        method: "SUBSCRIBE";
        params: string[];
    }
    | {
        method: "UNSUBSCRIBE";
        params: string[];
    };

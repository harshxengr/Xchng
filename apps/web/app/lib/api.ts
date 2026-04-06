export type Depth = {
    bids: [string, string][];
    asks: [string, string][];
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

export type OpenOrder = {
    orderId: string;
    userId: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
    filled: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4002";

export function getWsUrl() {
    return WS_URL;
}

export async function getDepth(symbol: string): Promise<Depth> {
    const res = await fetch(`${API_URL}/depth?symbol=${symbol}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch depth");
    return res.json();
}

export async function getTrades(symbol: string): Promise<Trade[]> {
    const res = await fetch(`${API_URL}/trades?symbol=${symbol}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch trades");
    return res.json();
}

export async function getTicker(symbol: string): Promise<Ticker> {
    const res = await fetch(`${API_URL}/ticker?symbol=${symbol}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch ticker");
    return res.json();
}

export async function getTickers(): Promise<Ticker[]> {
    const res = await fetch(`${API_URL}/tickers`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch tickers");
    return res.json();
}

export async function getBalances(userId: string) {
    const res = await fetch(`${API_URL}/balances?userId=${userId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch balances");
    return res.json();
}

export async function getOpenOrders(market: string, userId: string): Promise<OpenOrder[]> {
    const res = await fetch(`${API_URL}/order/open?market=${market}&userId=${userId}`, {
        cache: "no-store"
    });
    if (!res.ok) throw new Error("Failed to fetch open orders");
    return res.json();
}

export async function placeOrder(input: {
    market: string;
    userId: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
}) {
    const res = await fetch(`${API_URL}/order`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error ?? "Failed to place order");
    }

    return data;
}

export async function cancelOrder(input: { market: string; orderId: string }) {
    const res = await fetch(`${API_URL}/order`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error ?? "Failed to cancel order");
    }

    return data;
}
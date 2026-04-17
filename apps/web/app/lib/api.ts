import type {
    Trade,
    Ticker,
    UserBalance,
    Depth
} from "@workspace/types";
import { env } from "@workspace/env";

export type { Trade, Ticker, Depth, UserBalance };

export type OpenOrder = {
    orderId: string;
    userId: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
    filled: number;
};

export type OrderHistoryEntry = {
    id: string;
    market: string;
    userId: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
    filledQuantity: number;
    status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
    createdAt: number;
    updatedAt: number;
};
export type UserBalances = UserBalance;
export type Kline = {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};
export type MmBotStatus = {
    market: string;
    paused: boolean;
    health: "healthy" | "paused" | "stale" | "degraded";
    referencePrice: number;
    activeBidOrders: number;
    activeAskOrders: number;
    desiredBidQuotes: number;
    desiredAskQuotes: number;
    totalQuotesPlaced: number;
    totalQuotesCancelled: number;
    bidBaseInventory: number;
    bidQuoteInventory: number;
    askBaseInventory: number;
    askQuoteInventory: number;
    loopCount: number;
    successCount: number;
    errorCount: number;
    consecutiveErrorCount: number;
    inventorySkewBps: number;
    lastCyclePlaced: number;
    lastCycleCancelled: number;
    lastLoopDurationMs: number | null;
    lastSuccessAt: number | null;
    lastRefreshAt: number | null;
    controlUpdatedAt: number | null;
    startedAt: number | null;
    lastError: string | null;
};
type PlaceOrderInput = {
    market: string;
    userId: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
};
type CancelOrderInput = {
    market: string;
    orderId: string;
};

const API_URL = env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const WS_URL = env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001";

export function getWsUrl() { return WS_URL; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const data = await res.json();
    if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Request failed";
        throw new Error(message);
    }
    return data as T;
}

export async function getDepth(symbol: string): Promise<Depth> {
    return fetchJson<Depth>(`${API_URL}/depth?symbol=${symbol}`);
}

export async function getTrades(symbol: string): Promise<Trade[]> {
    return fetchJson<Trade[]>(`${API_URL}/trades?symbol=${symbol}`);
}

export async function getTicker(symbol: string): Promise<Ticker> {
    return fetchJson<Ticker>(`${API_URL}/ticker?symbol=${symbol}`);
}

export async function getTickers(): Promise<Ticker[]> {
    return fetchJson<Ticker[]>(`${API_URL}/tickers`);
}

export async function getBalances(userId: string): Promise<UserBalance> {
    return fetchJson<UserBalance>(`${API_URL}/balances?userId=${userId}`);
}

export async function getOpenOrders(market: string, userId: string): Promise<OpenOrder[]> {
    return fetchJson<OpenOrder[]>(`${API_URL}/order/open?market=${market}&userId=${userId}`);
}

export async function getOrderHistory(userId: string, market: string, limit?: number): Promise<OrderHistoryEntry[]> {
    const url = `${API_URL}/order/history?userId=${userId}&market=${market}${limit ? `&limit=${limit}` : ''}`;
    return fetchJson<OrderHistoryEntry[]>(url);
}

export async function getMmBotStatuses(): Promise<MmBotStatus[]> {
    return fetchJson<MmBotStatus[]>(`${API_URL}/mm-bot/statuses`);
}

export async function setMmBotPaused(botId: string, paused: boolean): Promise<void> {
    await fetchJson<void>(`${API_URL}/mm-bot/paused`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, paused })
    });
}

export async function placeOrder(input: PlaceOrderInput) {
    return fetchJson<{ success: boolean; orderId?: string; error?: string }>(`${API_URL}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
    });
}

export async function cancelOrder(input: CancelOrderInput) {
    return fetchJson<{ success: boolean; error?: string }>(`${API_URL}/order`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
    });
}
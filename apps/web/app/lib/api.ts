import type {
    Order,
    Trade,
    Ticker,
    AssetBalance,
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

export type OrderHistoryEntry = any;
export type UserBalances = UserBalance;
export type Kline = any;
export type MmBotStatus = any;

const API_URL = env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const WS_URL = env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001";

export function getWsUrl() { return WS_URL; }

export async function getDepth(symbol: string): Promise<Depth> {
    const res = await fetch(`${API_URL}/depth?symbol=${symbol}`);
    return res.json();
}

export async function getTrades(symbol: string): Promise<Trade[]> {
    const res = await fetch(`${API_URL}/trades?symbol=${symbol}`);
    return res.json();
}

export async function getTicker(symbol: string): Promise<Ticker> {
    const res = await fetch(`${API_URL}/ticker?symbol=${symbol}`);
    return res.json();
}

export async function getTickers(): Promise<Ticker[]> {
    const res = await fetch(`${API_URL}/tickers`);
    return res.json();
}

export async function getBalances(userId: string): Promise<UserBalance> {
    const res = await fetch(`${API_URL}/balances?userId=${userId}`);
    return res.json();
}

export async function getOpenOrders(market: string, userId: string): Promise<OpenOrder[]> {
    const res = await fetch(`${API_URL}/order/open?market=${market}&userId=${userId}`);
    return res.json();
}

export async function getOrderHistory(userId: string, market: string, limit?: number): Promise<OrderHistoryEntry[]> {
    const url = `${API_URL}/order/history?userId=${userId}&market=${market}${limit ? `&limit=${limit}` : ''}`;
    const res = await fetch(url);
    return res.json();
}

export async function getMmBotStatuses(): Promise<MmBotStatus[]> {
    const res = await fetch(`${API_URL}/mm-bot/statuses`);
    return res.json();
}

export async function setMmBotPaused(botId: string, paused: boolean): Promise<void> {
    const res = await fetch(`${API_URL}/mm-bot/paused`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, paused })
    });
    return res.json();
}

export async function placeOrder(input: any) {
    const res = await fetch(`${API_URL}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
    });
    return res.json();
}

export async function cancelOrder(input: any) {
    const res = await fetch(`${API_URL}/order`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
    });
    return res.json();
}
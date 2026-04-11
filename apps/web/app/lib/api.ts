import type { 
    Order, 
    Trade, 
    Ticker, 
    AssetBalance, 
    UserBalance 
} from "@workspace/shared";

// We re-export specialized types if they aren't in shared yet, 
// but most should come from @workspace/shared.

export type Depth = {
    bids: [string, string][];
    asks: [string, string][];
};

export type OpenOrder = {
    orderId: string;
    userId: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
    filled: number;
};

// ... existing types keep working if they match ...

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001";

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

export async function getBalances(userId: string): Promise<UserBalance> {
    const res = await fetch(`${API_URL}/balances?userId=${userId}`);
    return res.json();
}

export async function getOpenOrders(market: string, userId: string): Promise<OpenOrder[]> {
    const res = await fetch(`${API_URL}/order/open?market=${market}&userId=${userId}`);
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
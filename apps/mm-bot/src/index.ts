import { Redis } from "ioredis";
import { env } from "@workspace/env";

// --- CONFIGURATION (Direct from process.env) ---
const API_URL = env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const MARKETS = (process.env.MM_MARKETS || "TATA_INR").split(",").map(m => m.trim());
const LOOP_INTERVAL = parseInt(process.env.MM_LOOP_INTERVAL_MS || "5000");
const MM_REDIS_KEYS = {
    control: (market: string) => `mm-bot:control:${market}`,
    status: (market: string) => `mm-bot:status:${market}`
};

// Create Redis client inline
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

type MarketStats = {
    loopCount: number;
    successCount: number;
    errorCount: number;
    consecutiveErrorCount: number;
    totalQuotesPlaced: number;
    totalQuotesCancelled: number;
    lastCyclePlaced: number;
    lastCycleCancelled: number;
    lastLoopDurationMs: number | null;
    lastSuccessAt: number | null;
    lastRefreshAt: number | null;
    startedAt: number;
    lastError: string | null;
};

const marketStats = new Map<string, MarketStats>();

function getStats(market: string): MarketStats {
    const existing = marketStats.get(market);
    if (existing) {
        return existing;
    }

    const initial: MarketStats = {
        loopCount: 0,
        successCount: 0,
        errorCount: 0,
        consecutiveErrorCount: 0,
        totalQuotesPlaced: 0,
        totalQuotesCancelled: 0,
        lastCyclePlaced: 0,
        lastCycleCancelled: 0,
        lastLoopDurationMs: null,
        lastSuccessAt: null,
        lastRefreshAt: null,
        startedAt: Date.now(),
        lastError: null
    };
    marketStats.set(market, initial);
    return initial;
}

async function isPaused(market: string): Promise<boolean> {
    const raw = await redis.get(MM_REDIS_KEYS.control(market));
    if (!raw) {
        return false;
    }

    try {
        const parsed = JSON.parse(raw) as { paused?: boolean };
        return parsed.paused === true;
    } catch {
        return false;
    }
}

async function publishStatus(market: string, price: number, paused: boolean) {
    const stats = getStats(market);
    const payload = {
        market,
        paused,
        health: paused ? "paused" : stats.consecutiveErrorCount > 0 ? "degraded" : "healthy",
        referencePrice: price,
        activeBidOrders: paused ? 0 : 1,
        activeAskOrders: paused ? 0 : 1,
        desiredBidQuotes: 1,
        desiredAskQuotes: 1,
        totalQuotesPlaced: stats.totalQuotesPlaced,
        totalQuotesCancelled: stats.totalQuotesCancelled,
        bidBaseInventory: 0,
        bidQuoteInventory: 0,
        askBaseInventory: 0,
        askQuoteInventory: 0,
        loopCount: stats.loopCount,
        successCount: stats.successCount,
        errorCount: stats.errorCount,
        consecutiveErrorCount: stats.consecutiveErrorCount,
        inventorySkewBps: 0,
        lastCyclePlaced: stats.lastCyclePlaced,
        lastCycleCancelled: stats.lastCycleCancelled,
        lastLoopDurationMs: stats.lastLoopDurationMs,
        lastSuccessAt: stats.lastSuccessAt,
        lastRefreshAt: stats.lastRefreshAt,
        controlUpdatedAt: Date.now(),
        startedAt: stats.startedAt,
        lastError: stats.lastError
    };

    await redis.set(MM_REDIS_KEYS.status(market), JSON.stringify(payload));
}

/**
 * Simplified Market Maker Bot.
 * It periodically checks the price and places a ladder of buy/sell orders.
 */
async function runMarketLoop(market: string) {
    const userId = `mm-${market.toLowerCase()}`;
    console.log(`[MM-BOT] Starting loop for ${market} as ${userId}`);

    while (true) {
        const startedAt = Date.now();
        const stats = getStats(market);
        stats.loopCount += 1;
        stats.lastCyclePlaced = 0;
        stats.lastCycleCancelled = 0;

        try {
            // 1. Get current market state
            const tickerRes = await fetch(`${API_URL}/ticker?symbol=${market}`);
            const ticker = await tickerRes.json();
            const price = parseFloat(ticker.lastPrice) || 100;
            const paused = await isPaused(market);

            if (paused) {
                stats.lastRefreshAt = Date.now();
                stats.lastLoopDurationMs = Date.now() - startedAt;
                await publishStatus(market, price, true);
                await new Promise(r => setTimeout(r, LOOP_INTERVAL));
                continue;
            }

            // 2. Get our existing orders
            const ordersRes = await fetch(`${API_URL}/order/open?market=${market}&userId=${userId}`);
            const existingOrders = await ordersRes.json();

            // 3. Cancel all our old orders to keep it simple (junior style)
            // A more advanced dev would only cancel if price moved, but this is fine for a demo.
            if (Array.isArray(existingOrders)) {
                for (const order of existingOrders) {
                    await fetch(`${API_URL}/order`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ market, orderId: order.orderId, userId })
                    });
                    stats.lastCycleCancelled += 1;
                    stats.totalQuotesCancelled += 1;
                }
            }

            // 4. Place a new ladder (1 buy, 1 sell for simplicity)
            const spread = 0.01; // 1%
            await placeOrder(market, userId, "buy", price * (1 - spread), 1);
            await placeOrder(market, userId, "sell", price * (1 + spread), 1);
            stats.lastCyclePlaced += 2;
            stats.totalQuotesPlaced += 2;
            stats.successCount += 1;
            stats.consecutiveErrorCount = 0;
            stats.lastSuccessAt = Date.now();
            stats.lastRefreshAt = Date.now();
            stats.lastError = null;
            stats.lastLoopDurationMs = Date.now() - startedAt;
            await publishStatus(market, price, false);

            console.log(`[MM-BOT] ${market} updated. Ref price: ${price}`);
        } catch (e) {
            stats.errorCount += 1;
            stats.consecutiveErrorCount += 1;
            stats.lastError = e instanceof Error ? e.message : "Unknown error";
            stats.lastRefreshAt = Date.now();
            stats.lastLoopDurationMs = Date.now() - startedAt;
            await publishStatus(market, 0, false);
            console.error(`[MM-BOT] ${market} loop error:`, e);
        }

        await new Promise(r => setTimeout(r, LOOP_INTERVAL));
    }
}

async function placeOrder(market: string, userId: string, side: string, price: number, quantity: number) {
    await fetch(`${API_URL}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, userId, side, price, quantity })
    });
}

function start() {
    MARKETS.forEach(runMarketLoop);
}

start();

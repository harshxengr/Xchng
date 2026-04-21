import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { Redis } from "ioredis";
import * as database from "@workspace/database";
import * as serverEnv from "@workspace/env/server";
import type { EngineCommandResult } from "@workspace/types";

const prisma = database.prisma ?? database.default?.prisma;
const env = serverEnv.env ?? serverEnv.default?.env;

const app = express();
const port = env.PORT || 4000;

// Redis channels - inline as per junior dev style
const REDIS_CHANNELS = {
  COMMANDS: "engine:commands",
};

const REDIS_KEYS = {
  depth: (market: string) => `depth:${market}`,
};
const MM_REDIS_KEYS = {
  control: (market: string) => `mm-bot:control:${market}`,
  status: (market: string) => `mm-bot:status:${market}`,
};
const MM_MARKETS = (process.env.MM_MARKETS || "TATA_INR")
  .split(",")
  .map((market) => market.trim())
  .filter(Boolean);

// Create Redis clients inline
const redisPublisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const redisSubscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};
const pendingRequests = new Map<string, PendingRequest>();

redisSubscriber.psubscribe("rpc.response.*");
redisSubscriber.on("pmessage", (_pattern, channel, message) => {
    const requestId = channel.replace("rpc.response.", "");
    const pending = pendingRequests.get(requestId);
    if (!pending) {
        return;
    }

    clearTimeout(pending.timeout);
    pendingRequests.delete(requestId);

    try {
        const result = JSON.parse(message) as EngineCommandResult<unknown>;
        if (result.ok) {
            pending.resolve(result.data);
            return;
        }
        pending.reject(new Error(result.error || "Engine error"));
    } catch (error) {
        pending.reject(error instanceof Error ? error : new Error("Invalid engine response"));
    }
});

app.use(cors());
app.use(express.json());

// --- INTERNAL HELPERS ---

// Sends a command to the engine and waits for the response with a request id.
async function sendCommandToEngine<T>(type: string, payload: any): Promise<T> {
    const requestId = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error("Engine timeout"));
        }, 5000);

        pendingRequests.set(requestId, {
            timeout,
            resolve: (value) => resolve(value as T),
            reject
        });

        // Push command in Redis list for the matching engine worker.
        redisPublisher.rpush(REDIS_CHANNELS.COMMANDS, JSON.stringify({
            type,
            requestId,
            payload
        })).catch((error) => {
            clearTimeout(timeout);
            pendingRequests.delete(requestId);
            reject(error instanceof Error ? error : new Error("Failed to publish command"));
        });
    });
}

type MmBotStatus = {
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

function buildDefaultMmStatus(market: string, paused: boolean): MmBotStatus {
    return {
        market,
        paused,
        health: paused ? "paused" : "stale",
        referencePrice: 0,
        activeBidOrders: 0,
        activeAskOrders: 0,
        desiredBidQuotes: 1,
        desiredAskQuotes: 1,
        totalQuotesPlaced: 0,
        totalQuotesCancelled: 0,
        bidBaseInventory: 0,
        bidQuoteInventory: 0,
        askBaseInventory: 0,
        askQuoteInventory: 0,
        loopCount: 0,
        successCount: 0,
        errorCount: 0,
        consecutiveErrorCount: 0,
        inventorySkewBps: 0,
        lastCyclePlaced: 0,
        lastCycleCancelled: 0,
        lastLoopDurationMs: null,
        lastSuccessAt: null,
        lastRefreshAt: null,
        controlUpdatedAt: null,
        startedAt: null,
        lastError: null
    };
}

async function getMmBotStatuses(): Promise<MmBotStatus[]> {
    const statuses = await Promise.all(
        MM_MARKETS.map(async (market) => {
            const [statusRaw, controlRaw] = await Promise.all([
                redisPublisher.get(MM_REDIS_KEYS.status(market)),
                redisPublisher.get(MM_REDIS_KEYS.control(market))
            ]);

            const paused =
                typeof controlRaw === "string"
                    ? JSON.parse(controlRaw).paused === true
                    : false;

            if (!statusRaw) {
                return buildDefaultMmStatus(market, paused);
            }

            try {
                const parsed = JSON.parse(statusRaw) as MmBotStatus;
                return { ...parsed, paused };
            } catch {
                return buildDefaultMmStatus(market, paused);
            }
        })
    );

    return statuses;
}

// --- API ROUTES ---

app.get("/health", (req, res) => res.json({ ok: true }));

// Orders
app.post("/api/v1/order", async (req, res) => {
    try {
        const result = await sendCommandToEngine("PLACE_ORDER", req.body);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.delete("/api/v1/order", async (req, res) => {
    try {
        const result = await sendCommandToEngine("CANCEL_ORDER", req.body);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/order/open", async (req, res) => {
    try {
        const { market, userId } = req.query as { market: string, userId: string };
        const orders = await prisma.$queryRaw`
            SELECT * FROM "Order"
            WHERE "market" = ${market}
            AND "userId" = ${userId}
            AND "status" IN ('OPEN', 'PARTIALLY_FILLED')
            ORDER BY "createdAt" ASC
        ` as any[];
        res.json(orders.map((o: any) => ({
            orderId: o.id,
            userId: o.userId,
            side: o.side,
            price: Number(o.price),
            quantity: Number(o.quantity),
            filled: Number(o.filledQuantity)
        })));
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/order/history", async (req, res) => {
    try {
        const { userId, market, limit = "50" } = req.query as any;
        let query = `SELECT * FROM "Order" WHERE 1=1`;
        const params: any[] = [];
        if (userId) { params.push(userId); query += ` AND "userId" = $${params.length}`; }
        if (market) { params.push(market); query += ` AND "market" = $${params.length}`; }
        query += ` ORDER BY "createdAt" DESC LIMIT ${parseInt(limit)}`;
        const orders = await prisma.$queryRawUnsafe(query, ...params) as any[];
        res.json(orders);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// Market Data
app.get("/api/v1/depth", async (req, res) => {
    try {
        const { symbol } = req.query as { symbol: string };
        const data = await redisPublisher.get(REDIS_KEYS.depth(symbol));
        res.json(data ? JSON.parse(data) : { bids: [], asks: [] });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/trades", async (req, res) => {
    try {
        const { symbol } = req.query as { symbol: string };
        const trades = await prisma.$queryRaw`
            SELECT * FROM "Trade"
            WHERE "market" = ${symbol}
            ORDER BY "timestamp" DESC
            LIMIT 50
        ` as any[];
        res.json(trades);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/ticker", async (req, res) => {
    try {
        const { symbol } = req.query as { symbol: string };
        const tickers = await prisma.tickerSnapshot.findMany({
            where: { market: symbol },
            orderBy: { timestamp: "desc" },
            take: 1
        });
        res.json(tickers[0] || { symbol, lastPrice: "0" });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/tickers", async (req, res) => {
    try {
        const tickers = await prisma.$queryRaw`
            SELECT DISTINCT ON ("market") * FROM "TickerSnapshot"
            ORDER BY "market", "timestamp" DESC
        ` as any[];
        res.json(tickers);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// User
app.get("/api/v1/balances", async (req, res) => {
    try {
        const { userId } = req.query as { userId: string };
        let balances = await prisma.$queryRaw`
            SELECT * FROM "Balance"
            WHERE "userId" = ${userId}
        ` as any[];

        if (balances.length === 0) {
            const defaultAssets = ["TATA", "INR"];
            for (const asset of defaultAssets) {
                await prisma.$queryRaw`
                    INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
                    VALUES (gen_random_uuid(), ${userId}, ${asset}, '0', '0')
                `;
            }
            balances = await prisma.$queryRaw`
                SELECT * FROM "Balance"
                WHERE "userId" = ${userId}
            ` as any[];
        }

        const result: Record<string, { available: number; locked: number }> = {};
        for (const b of balances) {
            result[b.asset] = { available: Number(b.available), locked: Number(b.locked) };
        }
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.post("/api/v1/deposit", async (req, res) => {
    try {
        const result = await sendCommandToEngine("DEPOSIT", req.body);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/mm-bot/statuses", async (_req, res) => {
    try {
        const statuses = await getMmBotStatuses();
        res.json(statuses);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/mm-bot/status", async (_req, res) => {
    try {
        const statuses = await getMmBotStatuses();
        res.json(statuses);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.post("/api/v1/mm-bot/paused", async (req, res) => {
    try {
        const { botId, paused } = req.body as { botId?: string; paused?: boolean };
        if (!botId || typeof paused !== "boolean") {
            res.status(400).json({ success: false, error: "botId and paused are required" });
            return;
        }

        await redisPublisher.set(
            MM_REDIS_KEYS.control(botId),
            JSON.stringify({
                paused,
                updatedAt: Date.now()
            })
        );

        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.post("/api/v1/mm-bot/control", async (req, res) => {
    try {
        const { botId, paused } = req.body as { botId?: string; paused?: boolean };
        if (!botId || typeof paused !== "boolean") {
            res.status(400).json({ success: false, error: "botId and paused are required" });
            return;
        }

        await redisPublisher.set(
            MM_REDIS_KEYS.control(botId),
            JSON.stringify({
                paused,
                updatedAt: Date.now()
            })
        );

        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// --- SERVER START ---

app.listen(port, () => {
    console.log(`API Server running on port ${port}`);
});

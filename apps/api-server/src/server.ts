import { createServer } from "node:net";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { Redis } from "ioredis";
import { prisma } from "@workspace/database";
import { env } from "@workspace/env/server";
import type { PlaceOrderInput, EngineCommandResult } from "@workspace/types";

const app = express();
const port = env.PORT || 4000;

// Redis channels - inline as per junior dev style
const REDIS_CHANNELS = {
  COMMANDS: "engine:commands",
  EVENTS: "engine:events",
  rpcResponse: (requestId: string) => `rpc.response.${requestId}`,
};

const REDIS_KEYS = {
  depth: (market: string) => `depth:${market}`,
};

// Create Redis clients inline
const redisPublisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

app.use(cors());
app.use(express.json());

// --- INTERNAL HELPERS ---

/**
 * Simplified RPC over Redis.
 * Sends a command to the engine and waits for a response on a unique channel.
 */
async function sendCommandToEngine<T>(type: string, payload: any): Promise<T> {
    const requestId = crypto.randomUUID();
    const responseChannel = REDIS_CHANNELS.rpcResponse(requestId);
    
    // Create a temporary subscriber for this request
    const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await subscriber.subscribe(responseChannel);

    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(async () => {
            await subscriber.unsubscribe(responseChannel);
            subscriber.disconnect();
            reject(new Error("Engine timeout"));
        }, 5000);

        subscriber.on("message", async (channel, message) => {
            if (channel === responseChannel) {
                clearTimeout(timeout);
                await subscriber.unsubscribe(responseChannel);
                subscriber.disconnect();

                const result = JSON.parse(message) as EngineCommandResult<T>;
                if (result.ok) {
                    resolve(result.data!);
                } else {
                    reject(new Error(result.error || "Engine error"));
                }
            }
        });

        // Send the command to the engine's queue
        redisPublisher.rpush(REDIS_CHANNELS.COMMANDS, JSON.stringify({
            type,
            requestId,
            payload
        }));
    });
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

// --- SERVER START ---

app.listen(port, () => {
    console.log(`API Server running on port ${port}`);
});

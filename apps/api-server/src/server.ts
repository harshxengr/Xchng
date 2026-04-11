import { createServer } from "node:net";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { 
  createRedisClient, 
  REDIS_CHANNELS, 
  REDIS_KEYS,
  getLatestTickers,
  getLatestTickerByMarket,
  getRecentTrades,
  ensureAndLoadBalances,
  getOpenOrdersForUser,
  getOrderHistory,
  query
} from "@workspace/shared";
import type { PlaceOrderInput, EngineCommandResult } from "@workspace/shared";

const app = express();
const port = process.env.PORT || 4000;

// Use a shared publisher for all commands
const redisPublisher = createRedisClient();

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
    const subscriber = createRedisClient();
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
        const orders = await getOpenOrdersForUser(market, userId);
        res.json(orders.map(o => ({
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
        const orders = await getOrderHistory({ userId, market, limit: parseInt(limit) });
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
        const trades = await getRecentTrades(symbol);
        res.json(trades);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/ticker", async (req, res) => {
    try {
        const { symbol } = req.query as { symbol: string };
        const ticker = await getLatestTickerByMarket(symbol);
        res.json(ticker || { symbol, lastPrice: "0" });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get("/api/v1/tickers", async (req, res) => {
    try {
        const tickers = await getLatestTickers();
        res.json(tickers);
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// User
app.get("/api/v1/balances", async (req, res) => {
    try {
        const { userId } = req.query as { userId: string };
        const balances = await ensureAndLoadBalances(userId);
        res.json(balances);
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

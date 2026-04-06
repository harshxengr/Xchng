import { createServer } from "node:net";
import express from "express";
import cors from "cors";
import type { Response } from "express";
import { env } from "@workspace/env";
import { Engine } from "engine";
import { WsManager } from "@workspace/ws";
import {
    balancesQuerySchema,
    cancelOrderSchema,
    depositSchema,
    depthQuerySchema,
    openOrdersQuerySchema,
    placeOrderSchema,
    tradesQuerySchema,
    tickerQuerySchema
} from "@workspace/types";
import { prisma } from "@workspace/database";
import { PersistedTickerInput } from "@workspace/types";
import { toTickerCreateInput } from "./lib/mappers.js";

const app = express();
const defaultPort = env.PORT ?? 4000;
const defaultWsPort = env.WS_PORT ?? 4001;

const engine = new Engine();
const ws = new WsManager(defaultWsPort);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});


export async function saveTickerSnapshot(ticker: PersistedTickerInput) {
    await prisma.tickerSnapshot.create({
        data: toTickerCreateInput(ticker)
    });
}

export async function getLatestTickers() {
    return prisma.tickerSnapshot.findMany({
        orderBy: { timestamp: "desc" }
    });
}

app.delete("/api/v1/order", (req, res) => {
    try {
        const input = cancelOrderSchema.parse(req.body);
        const result = engine.cancelOrder(input.market, input.orderId);

        const depth = engine.getDepth(input.market);
        const ticker = engine.getTicker(input.market);

        ws.broadcastDepth(input.market, depth);
        ws.broadcastTicker(input.market, ticker);

        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/order/open", (req, res) => {
    try {
        const input = openOrdersQuerySchema.parse(req.query);
        res.json(engine.getOpenOrders(input.market, input.userId));
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/depth", (req, res) => {
    try {
        const input = depthQuerySchema.parse(req.query);
        res.json(engine.getDepth(input.symbol));
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/trades", (req, res) => {
    try {
        const input = tradesQuerySchema.parse(req.query);
        res.json(engine.getTrades(input.symbol));
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/ticker", (req, res) => {
    try {
        const input = tickerQuerySchema.parse(req.query);
        res.json(engine.getTicker(input.symbol));
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/tickers", (_req, res) => {
    try {
        res.json(engine.getTickers());
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/balances", (req, res) => {
    try {
        const input = balancesQuerySchema.parse(req.query);
        res.json(engine.getBalances(input.userId));
    } catch (error) {
        handleError(res, error);
    }
});

app.post("/api/v1/deposit", (req, res) => {
    try {
        const input = depositSchema.parse(req.body);
        engine.deposit(input.userId, input.asset, input.amount);
        res.json({
            success: true,
            balances: engine.getBalances(input.userId)
        });
    } catch (error) {
        handleError(res, error);
    }
});

function handleError(res: Response, error: unknown): void {
    if (error instanceof Error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
        return;
    }

    res.status(500).json({
        success: false,
        error: "Internal server error"
    });
}

async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = createServer();

        server.once("error", () => {
            resolve(false);
        });

        server.once("listening", () => {
            server.close(() => resolve(true));
        });

        server.listen(port);
    });
}

async function findAvailablePort(startPort: number, label: string, blockedPorts: number[] = []): Promise<number> {
    for (let offset = 0; offset < 20; offset += 1) {
        const candidate = startPort + offset;
        if (blockedPorts.includes(candidate)) {
            continue;
        }
        if (await isPortAvailable(candidate)) {
            if (candidate !== startPort) {
                console.warn(`${label} port ${startPort} is busy, using ${candidate} instead`);
            }
            return candidate;
        }
    }

    throw new Error(`No available ${label.toLowerCase()} port found starting from ${startPort}`);
}

async function start(): Promise<void> {
    const port = await findAvailablePort(defaultPort, "API");
    const wsPort = await findAvailablePort(defaultWsPort, "WS", [port]);
    const ws = new WsManager(wsPort);

    app.listen(port, () => {
        console.log(`API running on http://localhost:${port}`);
        console.log(`WS running on ws://localhost:${wsPort}`);
    });
}

start().catch((error) => {
    console.error("Failed to start api-server", error);
    process.exit(1);
});

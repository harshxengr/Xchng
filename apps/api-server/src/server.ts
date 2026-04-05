import express from "express";
import cors from "cors";
import type { Response } from "express";
import { Engine } from "engine";
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

const app = express();
const port = 3000;

const engine = new Engine();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

app.post("/api/v1/order", (req, res) => {
    try {
        const input = placeOrderSchema.parse(req.body);
        const result = engine.placeOrder(input);
        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
});

app.delete("/api/v1/order", (req, res) => {
    try {
        const input = cancelOrderSchema.parse(req.body);
        const result = engine.cancelOrder(input.market, input.orderId);
        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/order/open", (req, res) => {
    try {
        const input = openOrdersQuerySchema.parse(req.query);
        const result = engine.getOpenOrders(input.market, input.userId);
        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/depth", (req, res) => {
    try {
        const input = depthQuerySchema.parse(req.query);
        const result = engine.getDepth(input.symbol);
        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
});

app.get("/api/v1/trades", (req, res) => {
    try {
        const input = tradesQuerySchema.parse(req.query);
        const result = engine.getTrades(input.symbol);
        res.json(result);
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
        const result = engine.getBalances(input.userId);
        res.json(result);
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

app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});
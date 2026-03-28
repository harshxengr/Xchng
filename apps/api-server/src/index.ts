import express from "express";
import { OrderInputSchema } from "@workspace/types";
import { orderbook, bookWithQuantity } from "./orderbook";

const BASE_ASSETS = "BTC";
const QUOTE_ASSETS = "USD";

const app = express();
app.use(express.json());

let GLOBAL_TRADE_ID = 0;

app.post("/", (_req, res) => {
    res.status(200).json({ message: "Hello World" });
});

app.post("/api/v1/order", (req, res) => {
    const order = OrderInputSchema.safeParse(req.body);
    if (!order.success) {
        return res.status(400).json({ error: order.error.message });
    }

    const { baseAsset, quoteAsset, price, quantity, side, kind } = order.data;
    const orderId = getOrderId();

    if (baseAsset !== BASE_ASSETS || quoteAsset !== QUOTE_ASSETS) {
        return res.status(400).json({ error: "Invalid base or quote asset" });
    }

    const { executedQty, fills } = fillOrder(orderId, price, quantity, side, kind);

    res.send({
        orderId,
        executedQty,
        fills
    });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
    console.info(`API listening on http://localhost:${PORT}`);
});

function getOrderId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface Fill {
    price: number;
    qty: number;
    tradeId: number;
}

function fillOrder(
    orderId: string,
    price: number,
    quantity: number,
    side: "buy" | "sell",
    kind?: "ioc"
): { status: "rejected" | "accepted"; executedQty: number; fills: Fill[] } {
    const fills: Fill[] = [];
    const maxFillQuantity = getFillAmount(price, quantity, side);
    let executedQty = 0;

    if (kind === "ioc" && maxFillQuantity < quantity) {
        return { status: "rejected", executedQty: maxFillQuantity, fills: [] };
    }

    if (side === "buy") {
        orderbook.asks.forEach(o => {
            if (o.price <= price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity);
                o.quantity -= filledQuantity;
                bookWithQuantity.asks[o.price] = (bookWithQuantity.asks[o.price] || 0) - filledQuantity;
                fills.push({
                    price: o.price,
                    qty: filledQuantity,
                    tradeId: GLOBAL_TRADE_ID++
                });
                executedQty += filledQuantity;
                quantity -= filledQuantity;
                if (o.quantity === 0) {
                    orderbook.asks.splice(orderbook.asks.indexOf(o), 1);
                }
                if (bookWithQuantity.asks[o.price] === 0) {
                    delete bookWithQuantity.asks[o.price];
                }
            }
        });

        if (quantity !== 0) {
            orderbook.bids.push({
                price,
                quantity,
                side: "bid",
                orderId
            });
            bookWithQuantity.bids[price] = (bookWithQuantity.bids[price] || 0) + quantity;
        }
    } else {
        orderbook.bids.forEach(o => {
            if (o.price >= price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity);
                o.quantity -= filledQuantity;
                bookWithQuantity.bids[o.price] = (bookWithQuantity.bids[o.price] || 0) - filledQuantity;
                fills.push({
                    price: o.price,
                    qty: filledQuantity,
                    tradeId: GLOBAL_TRADE_ID++
                });
                executedQty += filledQuantity;
                quantity -= filledQuantity;
                if (o.quantity === 0) {
                    orderbook.bids.splice(orderbook.bids.indexOf(o), 1);
                }
                if (bookWithQuantity.bids[o.price] === 0) {
                    delete bookWithQuantity.bids[o.price];
                }
            }
        });

        if (quantity !== 0) {
            orderbook.asks.push({
                price,
                quantity,
                side: "ask",
                orderId
            });
            bookWithQuantity.asks[price] = (bookWithQuantity.asks[price] || 0) + quantity;
        }
    }

    return {
        status: "accepted",
        executedQty,
        fills
    };
}

function getFillAmount(limitPrice: number, orderQty: number, side: "buy" | "sell"): number {
    let remaining = orderQty;
    let filled = 0;
    if (side === "buy") {
        for (const o of orderbook.asks) {
            if (remaining <= 0) break;
            if (o.price <= limitPrice) {
                const q = Math.min(remaining, o.quantity);
                filled += q;
                remaining -= q;
            }
        }
    } else {
        for (const o of orderbook.bids) {
            if (remaining <= 0) break;
            if (o.price >= limitPrice) {
                const q = Math.min(remaining, o.quantity);
                filled += q;
                remaining -= q;
            }
        }
    }
    return filled;
}
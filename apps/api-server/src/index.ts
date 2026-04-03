import { randomUUID } from "node:crypto";
import express from "express";
import { env } from "@workspace/env";
import { OrderInputSchema } from "@workspace/types";
import { bookWithQuantity, orderbook } from "./orderbook";

const SUPPORTED_BASE_ASSET = "BTC";
const SUPPORTED_QUOTE_ASSET = "USD";

const app = express();
app.use(express.json());

let globalTradeId = 0;

app.post("/", (_req, res) => {
  res.status(200).json({ message: "Hello World" });
});

app.post("/api/v1/order", (req, res) => {
  const parsedOrder = OrderInputSchema.safeParse(req.body);

  if (!parsedOrder.success) {
    return res.status(400).json({ error: parsedOrder.error.message });
  }

  const { baseAsset, quoteAsset, price, quantity, side, kind } =
    parsedOrder.data;

  if (
    baseAsset !== SUPPORTED_BASE_ASSET ||
    quoteAsset !== SUPPORTED_QUOTE_ASSET
  ) {
    return res.status(400).json({ error: "Invalid base or quote asset" });
  }

  const orderId = createOrderId();
  const { executedQty, fills } = fillOrder(
    orderId,
    price,
    quantity,
    side,
    kind,
  );

  return res.send({
    orderId,
    executedQty,
    fills,
  });
});

const port = env.PORT ?? 4000;
app.listen(port, () => {
  console.info(`API listening on http://localhost:${port}`);
});

function createOrderId(): string {
  return randomUUID();
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
  kind?: "ioc",
): { status: "rejected" | "accepted"; executedQty: number; fills: Fill[] } {
  const fills: Fill[] = [];
  const maxFillQuantity = getFillAmount(price, quantity, side);
  let remainingQuantity = quantity;
  let executedQty = 0;

  if (kind === "ioc" && maxFillQuantity < quantity) {
    return { status: "rejected", executedQty: maxFillQuantity, fills: [] };
  }

  if (side === "buy") {
    const matchResult = matchOrders({
      orders: orderbook.asks,
      quantityByPrice: bookWithQuantity.asks,
      remainingQuantity,
      canMatch: (bookPrice) => bookPrice <= price,
    });

    remainingQuantity = matchResult.remainingQuantity;
    executedQty += matchResult.executedQty;
    fills.push(...matchResult.fills);

    if (remainingQuantity > 0) {
      orderbook.bids.push({
        price,
        quantity: remainingQuantity,
        side: "bid",
        orderId,
      });
      bookWithQuantity.bids[price] =
        (bookWithQuantity.bids[price] || 0) + remainingQuantity;
    }
  } else {
    const matchResult = matchOrders({
      orders: orderbook.bids,
      quantityByPrice: bookWithQuantity.bids,
      remainingQuantity,
      canMatch: (bookPrice) => bookPrice >= price,
    });

    remainingQuantity = matchResult.remainingQuantity;
    executedQty += matchResult.executedQty;
    fills.push(...matchResult.fills);

    if (remainingQuantity > 0) {
      orderbook.asks.push({
        price,
        quantity: remainingQuantity,
        side: "ask",
        orderId,
      });
      bookWithQuantity.asks[price] =
        (bookWithQuantity.asks[price] || 0) + remainingQuantity;
    }
  }

  return {
    status: "accepted",
    executedQty,
    fills,
  };
}

function matchOrders({
  orders,
  quantityByPrice,
  remainingQuantity,
  canMatch,
}: {
  orders: Array<{ price: number; quantity: number }>;
  quantityByPrice: Record<number, number>;
  remainingQuantity: number;
  canMatch: (bookPrice: number) => boolean;
}): { remainingQuantity: number; executedQty: number; fills: Fill[] } {
  const fills: Fill[] = [];
  let executedQty = 0;

  for (let index = 0; index < orders.length && remainingQuantity > 0; ) {
    const restingOrder = orders[index];

    if (!restingOrder) {
      break;
    }

    if (!canMatch(restingOrder.price)) {
      index += 1;
      continue;
    }

    const filledQuantity = Math.min(remainingQuantity, restingOrder.quantity);

    restingOrder.quantity -= filledQuantity;
    remainingQuantity -= filledQuantity;
    executedQty += filledQuantity;
    quantityByPrice[restingOrder.price] =
      (quantityByPrice[restingOrder.price] || 0) - filledQuantity;

    fills.push({
      price: restingOrder.price,
      qty: filledQuantity,
      tradeId: globalTradeId++,
    });

    if (restingOrder.quantity === 0) {
      orders.splice(index, 1);
    } else {
      index += 1;
    }

    if (quantityByPrice[restingOrder.price] === 0) {
      delete quantityByPrice[restingOrder.price];
    }
  }

  return {
    remainingQuantity,
    executedQty,
    fills,
  };
}

function getFillAmount(
  limitPrice: number,
  orderQty: number,
  side: "buy" | "sell",
): number {
  let remaining = orderQty;
  let filled = 0;

  if (side === "buy") {
    for (const order of orderbook.asks) {
      if (remaining <= 0) {
        break;
      }

      if (order.price <= limitPrice) {
        const filledQuantity = Math.min(remaining, order.quantity);
        filled += filledQuantity;
        remaining -= filledQuantity;
      }
    }
  } else {
    for (const order of orderbook.bids) {
      if (remaining <= 0) {
        break;
      }

      if (order.price >= limitPrice) {
        const filledQuantity = Math.min(remaining, order.quantity);
        filled += filledQuantity;
        remaining -= filledQuantity;
      }
    }
  }

  return filled;
}

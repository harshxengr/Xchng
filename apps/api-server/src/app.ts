import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as database from "@workspace/database";
import * as serverEnv from "@workspace/env/server";
import * as authModule from "@workspace/auth/server";
import { closeRedisClient, createRedisClient, logger } from "@workspace/runtime";
import type { EngineCommandResult } from "@workspace/types";

const prisma = database.prisma ?? database.default?.prisma;
const env = serverEnv.env ?? serverEnv.default?.env;
const auth = authModule.auth ?? (authModule as typeof authModule & { default?: typeof authModule }).default?.auth;

export const app: express.Express = express();

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

const MM_MARKETS = env.MM_MARKETS
  .split(",")
  .map((market) => market.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  [env.NEXT_PUBLIC_APP_URL, ...(env.CORS_ORIGINS ?? "").split(",")]
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const redisPublisher = createRedisClient(env.REDIS_URL, "publisher", "api-server");
const redisSubscriber = createRedisClient(env.REDIS_URL, "subscriber", "api-server");

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

const pendingRequests = new Map<string, PendingRequest>();

void redisSubscriber.psubscribe("rpc.response.*");
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

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}));
app.use(express.json({ limit: "128kb" }));

const INTERNAL_SECRET = env.INTERNAL_SECRET;

type AuthedRequest = express.Request & { user?: { id: string; email?: string } };

function toWebHeaders(headers: express.Request["headers"]) {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      result.set(key, value.join(", "));
    } else if (typeof value === "string") {
      result.set(key, value);
    }
  }
  return result;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function requireNumber(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return parsed;
}

function parseLimit(value: unknown, fallback = 50, max = 200) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function ensureSessionUser(req: AuthedRequest, requestedUserId?: unknown) {
  if (!requestedUserId) {
    return;
  }

  const sessionUserId = req.user?.id;
  if (sessionUserId && requestedUserId !== sessionUserId) {
    logger.warn("Unauthorized userId mismatch", { requestedUserId, sessionUserId });
    throw Object.assign(new Error("Unauthorized userId"), { statusCode: 403 });
  }
}

async function validateSession(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${INTERNAL_SECRET}`) {
    return next();
  }

  try {
    const session = await auth.api.getSession({
      headers: toWebHeaders(req.headers),
    });

    if (session) {
      req.user = session.user;
      return next();
    }
  } catch (error) {
    logger.error("Session validation error", { error });
  }

  res.status(401).json({ success: false, error: "Authentication required" });
}

async function sendCommandToEngine<T>(type: string, payload: unknown): Promise<T> {
  const requestId = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Engine timeout"));
    }, env.ENGINE_RPC_TIMEOUT_MS);

    pendingRequests.set(requestId, {
      timeout,
      resolve: (value) => resolve(value as T),
      reject,
    });

    redisPublisher.rpush(REDIS_CHANNELS.COMMANDS, JSON.stringify({
      type,
      requestId,
      payload,
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
    lastError: null,
  };
}

async function getMmBotStatuses(): Promise<MmBotStatus[]> {
  return Promise.all(
    MM_MARKETS.map(async (market) => {
      const [statusRaw, controlRaw] = await Promise.all([
        redisPublisher.get(MM_REDIS_KEYS.status(market)),
        redisPublisher.get(MM_REDIS_KEYS.control(market)),
      ]);

      const paused = typeof controlRaw === "string" ? JSON.parse(controlRaw).paused === true : false;
      if (!statusRaw) {
        return buildDefaultMmStatus(market, paused);
      }

      try {
        const parsed = JSON.parse(statusRaw) as MmBotStatus;
        return { ...parsed, paused };
      } catch {
        return buildDefaultMmStatus(market, paused);
      }
    }),
  );
}

function sendBadRequest(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Invalid request";
  res.status(400).json({ success: false, error: message });
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "api-server" }));

app.get("/ready", async (_req, res) => {
  try {
    const [redisResult] = await Promise.all([
      redisPublisher.ping(),
      prisma.$queryRaw`SELECT 1`,
    ]);
    res.json({ ok: true, redis: redisResult === "PONG", database: true });
  } catch (error) {
    logger.error("Readiness check failed", { error });
    res.status(503).json({ ok: false });
  }
});

app.post("/api/v1/order", validateSession, async (req: AuthedRequest, res) => {
  try {
    const market = requireString(req.body.market, "market");
    const userId = requireString(req.body.userId, "userId");
    const side = requireString(req.body.side, "side");
    const orderType = optionalString(req.body.orderType) ?? "limit";
    if (side !== "buy" && side !== "sell") {
      throw new Error("side must be buy or sell");
    }
    if (orderType !== "limit" && orderType !== "market") {
      throw new Error("orderType must be limit or market");
    }
    ensureSessionUser(req, userId);

    const result = await sendCommandToEngine("PLACE_ORDER", {
      market,
      userId,
      side,
      orderType,
      price: requireNumber(req.body.price, "price"),
      quantity: requireNumber(req.body.quantity, "quantity"),
    });
    res.json(result);
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === "number" ? (error as { statusCode: number }).statusCode : 400;
    res.status(statusCode).json({ success: false, error: error instanceof Error ? error.message : "Invalid request" });
  }
});

app.delete("/api/v1/order", validateSession, async (req: AuthedRequest, res) => {
  try {
    const payload = {
      market: requireString(req.body.market, "market"),
      orderId: requireString(req.body.orderId, "orderId"),
      userId: requireString(req.body.userId, "userId"),
    };
    ensureSessionUser(req, payload.userId);
    const result = await sendCommandToEngine("CANCEL_ORDER", payload);
    res.json(result);
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/order/open", validateSession, async (req: AuthedRequest, res) => {
  try {
    const market = requireString(req.query.market, "market");
    const userId = requireString(req.query.userId, "userId");
    ensureSessionUser(req, userId);

    const orders = await prisma.order.findMany({
      where: {
        market,
        userId,
        orderType: "limit",
        status: { in: ["OPEN", "PARTIALLY_FILLED"] },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(orders.map((order) => ({
      orderId: order.id,
      userId: order.userId,
      side: order.side,
      orderType: order.orderType,
      price: Number(order.price),
      quantity: Number(order.quantity),
      filled: Number(order.filledQuantity),
    })));
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/order/history", validateSession, async (req: AuthedRequest, res) => {
  try {
    const userId = optionalString(req.query.userId);
    const market = optionalString(req.query.market);
    const limit = parseLimit(req.query.limit);
    ensureSessionUser(req, userId);

    const orders = await prisma.order.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(market ? { market } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(orders);
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/depth", async (req, res) => {
  try {
    const symbol = requireString(req.query.symbol, "symbol");
    const data = await redisPublisher.get(REDIS_KEYS.depth(symbol));
    res.json(data ? JSON.parse(data) : { bids: [], asks: [] });
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/trades", async (req, res) => {
  try {
    const symbol = requireString(req.query.symbol, "symbol");
    const trades = await prisma.trade.findMany({
      where: { market: symbol },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    res.json(trades);
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/ticker", async (req, res) => {
  try {
    const symbol = requireString(req.query.symbol, "symbol");
    const ticker = await prisma.tickerSnapshot.findFirst({
      where: { market: symbol },
      orderBy: { timestamp: "desc" },
    });
    res.json(ticker ? { ...ticker, symbol: ticker.market } : { symbol, lastPrice: "0" });
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/tickers", async (_req, res) => {
  try {
    const tickers = await prisma.$queryRaw`
      SELECT DISTINCT ON ("market") * FROM "TickerSnapshot"
      ORDER BY "market", "timestamp" DESC
    ` as Array<{ market: string }>;
    res.json(tickers.map((ticker) => ({ ...ticker, symbol: ticker.market })));
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/balances", validateSession, async (req: AuthedRequest, res) => {
  try {
    const userId = requireString(req.query.userId, "userId");
    ensureSessionUser(req, userId);
    let balances = await prisma.balance.findMany({ where: { userId } });

    if (balances.length === 0) {
      await prisma.balance.createMany({
        data: ["TATA", "INR"].map((asset) => ({ userId, asset, available: "0", locked: "0" })),
        skipDuplicates: true,
      });
      balances = await prisma.balance.findMany({ where: { userId } });
    }

    const result: Record<string, { available: number; locked: number }> = {};
    for (const balance of balances) {
      result[balance.asset] = { available: Number(balance.available), locked: Number(balance.locked) };
    }
    res.json(result);
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.post("/api/v1/deposit", validateSession, async (req: AuthedRequest, res) => {
  try {
    const payload = {
      userId: requireString(req.body.userId, "userId"),
      asset: requireString(req.body.asset, "asset"),
      amount: requireNumber(req.body.amount, "amount"),
    };
    ensureSessionUser(req, payload.userId);
    const result = await sendCommandToEngine("DEPOSIT", payload);
    res.json(result);
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/mm-bot/statuses", async (_req, res) => {
  try {
    res.json(await getMmBotStatuses());
  } catch (error) {
    sendBadRequest(res, error);
  }
});

app.get("/api/v1/mm-bot/status", async (_req, res) => {
  try {
    res.json(await getMmBotStatuses());
  } catch (error) {
    sendBadRequest(res, error);
  }
});

async function setMmBotPaused(req: AuthedRequest, res: express.Response) {
  try {
    const botId = requireString(req.body.botId, "botId");
    const paused = req.body.paused;
    if (typeof paused !== "boolean") {
      throw new Error("paused must be a boolean");
    }

    await redisPublisher.set(MM_REDIS_KEYS.control(botId), JSON.stringify({
      paused,
      updatedAt: Date.now(),
    }));

    res.json({ success: true });
  } catch (error) {
    sendBadRequest(res, error);
  }
}

app.post("/api/v1/mm-bot/paused", validateSession, setMmBotPaused);
app.post("/api/v1/mm-bot/control", validateSession, setMmBotPaused);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled API error", { error });
  res.status(500).json({ success: false, error: "Internal server error" });
});

export async function closeApiResources() {
  for (const pending of pendingRequests.values()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("API server shutting down"));
  }
  pendingRequests.clear();
  await Promise.all([
    closeRedisClient(redisPublisher),
    closeRedisClient(redisSubscriber),
    prisma.$disconnect(),
  ]);
}

import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Redis } from "ioredis";
import { closeRedisClient, createRedisClient, logger } from "@workspace/runtime";
import type { EngineEvent } from "@workspace/types";

const REDIS_CHANNELS = {
  EVENTS: "engine:events",
};

const MAX_SUBSCRIPTIONS_PER_SOCKET = 32;
const HEARTBEAT_INTERVAL_MS = 30_000;
const subscriptions = new Map<WebSocket, Set<string>>();
const isAlive = new WeakMap<WebSocket, boolean>();
let subscriber: Redis | null = null;

function broadcast(channel: string, data: unknown) {
  const serialized = JSON.stringify(data);
  for (const [socket, subs] of subscriptions.entries()) {
    if (socket.readyState === WebSocket.OPEN && subs.has(channel)) {
      socket.send(serialized);
    }
  }
}

function parseParams(params: unknown) {
  if (!Array.isArray(params)) {
    return [];
  }

  return params
    .filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 128)
    .slice(0, MAX_SUBSCRIPTIONS_PER_SOCKET);
}

function bindWebSocketHandlers(wss: WebSocketServer) {
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (isAlive.get(socket) === false) {
        subscriptions.delete(socket);
        socket.terminate();
        continue;
      }

      isAlive.set(socket, false);
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  wss.on("connection", (socket, req) => {
    subscriptions.set(socket, new Set());
    isAlive.set(socket, true);
    logger.info("WebSocket connected", { remoteAddress: req.socket.remoteAddress });

    socket.on("pong", () => isAlive.set(socket, true));

    socket.on("message", (raw) => {
      try {
        if (Buffer.byteLength(raw.toString()) > 4096) {
          socket.close(1009, "Message too large");
          return;
        }

        const message = JSON.parse(raw.toString()) as { method?: string; params?: unknown };
        const params = parseParams(message.params);
        const subs = subscriptions.get(socket);
        if (!subs) {
          return;
        }

        if (message.method === "SUBSCRIBE") {
          for (const channel of params) {
            if (subs.size >= MAX_SUBSCRIPTIONS_PER_SOCKET) {
              break;
            }
            subs.add(channel);
          }
        } else if (message.method === "UNSUBSCRIBE") {
          for (const channel of params) {
            subs.delete(channel);
          }
        } else {
          socket.send(JSON.stringify({ type: "error", message: "Unsupported method" }));
        }
      } catch {
        socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      }
    });

    socket.on("close", () => subscriptions.delete(socket));
    socket.on("error", (error) => logger.warn("WebSocket client error", { error }));
    socket.send(JSON.stringify({ type: "connected" }));
  });

  wss.on("close", () => {
    clearInterval(heartbeat);
    subscriptions.clear();
  });
}

async function subscribeToEngineEvents(redisUrl: string) {
  if (subscriber) {
    return subscriber;
  }

  subscriber = createRedisClient(redisUrl, "subscriber", "ws");
  await subscriber.subscribe(REDIS_CHANNELS.EVENTS);

  subscriber.on("message", (_channel, raw) => {
    try {
      const event = JSON.parse(raw) as EngineEvent;

      if (event.type === "DEPTH_UPDATED") {
        broadcast(`depth@${event.market}`, { type: "depth", symbol: event.market, data: event.data });
      } else if (event.type === "TRADE_CREATED") {
        broadcast(`trade@${event.market}`, { type: "trade", symbol: event.market, data: event.data });
      } else if (event.type === "TICKER_UPDATED") {
        broadcast(`ticker@${event.market}`, { type: "ticker", symbol: event.market, data: event.data });
      } else if (event.type === "BALANCES_UPDATED") {
        broadcast(`balance@${event.data.userId}`, { type: "balance", userId: event.data.userId, data: event.data });
      }
    } catch (error) {
      logger.warn("Invalid engine event payload", { error });
    }
  });

  return subscriber;
}

export async function closeWebSocketResources() {
  await closeRedisClient(subscriber);
  subscriber = null;
}

export async function attachWebSocketServer(server: HttpServer, redisUrl: string) {
  const wss = new WebSocketServer({ server, maxPayload: 4096 });
  bindWebSocketHandlers(wss);
  await subscribeToEngineEvents(redisUrl);
  logger.info("WS attached to HTTP server", { channel: REDIS_CHANNELS.EVENTS });
  return wss;
}

export async function startStandaloneWebSocketServer(port: number, redisUrl: string) {
  const wss = new WebSocketServer({ port, maxPayload: 4096 });
  bindWebSocketHandlers(wss);
  await subscribeToEngineEvents(redisUrl);
  logger.info("WS service listening", { port, channel: REDIS_CHANNELS.EVENTS });
  return wss;
}

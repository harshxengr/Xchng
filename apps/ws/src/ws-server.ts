import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { Redis } from "ioredis";
import type { EngineEvent } from "@workspace/types";

const REDIS_CHANNELS = {
  EVENTS: "engine:events",
};

const subscriptions = new Map<WebSocket, Set<string>>();
let subscriber: Redis | null = null;

function broadcast(channel: string, data: unknown) {
    const serialized = JSON.stringify(data);
    for (const [socket, subs] of subscriptions.entries()) {
        if (socket.readyState === WebSocket.OPEN && subs.has(channel)) {
            socket.send(serialized);
        }
    }
}

function bindWebSocketHandlers(wss: WebSocketServer) {
    wss.on("connection", (socket) => {
        subscriptions.set(socket, new Set());

        socket.on("message", (raw) => {
            try {
                const message = JSON.parse(raw.toString());
                if (message.method === "SUBSCRIBE") {
                    const subs = subscriptions.get(socket);
                    if (subs) for (const ch of message.params) subs.add(ch);
                } else if (message.method === "UNSUBSCRIBE") {
                    const subs = subscriptions.get(socket);
                    if (subs) for (const ch of message.params) subs.delete(ch);
                }
            } catch {
                socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
            }
        });

        socket.on("close", () => subscriptions.delete(socket));
        socket.send(JSON.stringify({ type: "connected" }));
    });
}

async function subscribeToEngineEvents(redisUrl: string) {
    if (subscriber) {
        return subscriber;
    }

    subscriber = new Redis(redisUrl);
    await subscriber.subscribe(REDIS_CHANNELS.EVENTS);

    subscriber.on("message", (_channel, raw) => {
        const event = JSON.parse(raw) as EngineEvent;

        if (event.type === "DEPTH_UPDATED") {
            broadcast(`depth@${event.market}`, { type: "depth", symbol: event.market, data: event.data });
        } else if (event.type === "TRADE_CREATED") {
            broadcast(`trade@${event.market}`, { type: "trade", symbol: event.market, data: event.data });
        } else if (event.type === "TICKER_UPDATED") {
            broadcast(`ticker@${event.market}`, { type: "ticker", symbol: event.market, data: event.data });
        }
    });

    return subscriber;
}

export async function attachWebSocketServer(server: HttpServer, redisUrl: string) {
    const wss = new WebSocketServer({ server });
    bindWebSocketHandlers(wss);
    await subscribeToEngineEvents(redisUrl);
    console.log(`WS attached to HTTP server, subscribed to ${REDIS_CHANNELS.EVENTS}`);
    return wss;
}

export async function startStandaloneWebSocketServer(port: number, redisUrl: string) {
    const wss = new WebSocketServer({ port });
    bindWebSocketHandlers(wss);
    await subscribeToEngineEvents(redisUrl);
    console.log(`WS Service listening on port ${port}, subscribed to ${REDIS_CHANNELS.EVENTS}`);
    return wss;
}

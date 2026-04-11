import { WebSocketServer, WebSocket } from "ws";
import { createRedisClient, REDIS_CHANNELS } from "@workspace/shared";
import type { EngineEvent } from "@workspace/shared";

const port = Number(process.env.WS_PORT || 4001);
const wss = new WebSocketServer({ port });
const subscriptions = new Map<WebSocket, Set<string>>();

// --- WEBSOCKET SERVER LOGIC ---

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
        } catch (e) {
            socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
        }
    });

    socket.on("close", () => subscriptions.delete(socket));
    socket.send(JSON.stringify({ type: "connected" }));
});

function broadcast(channel: string, data: any) {
    const serialized = JSON.stringify(data);
    for (const [socket, subs] of subscriptions.entries()) {
        if (socket.readyState === WebSocket.OPEN && subs.has(channel)) {
            socket.send(serialized);
        }
    }
}

// --- REDIS PUB/SUB LOGIC ---

const subscriber = createRedisClient();

async function start() {
    await subscriber.subscribe(REDIS_CHANNELS.EVENTS);
    console.log(`WS Service listening on port ${port}, subscribed to ${REDIS_CHANNELS.EVENTS}`);

    subscriber.on("message", (channel, raw) => {
        const event = JSON.parse(raw) as EngineEvent;

        if (event.type === "DEPTH_UPDATED") {
            broadcast(`depth@${event.market}`, { type: "depth", symbol: event.market, data: event.data });
        } else if (event.type === "TRADE_CREATED") {
            broadcast(`trade@${event.market}`, { type: "trade", symbol: event.market, data: event.data });
        } else if (event.type === "TICKER_UPDATED") {
            broadcast(`ticker@${event.market}`, { type: "ticker", symbol: event.market, data: event.data });
        }
    });
}

start().catch(e => {
    console.error("WS failure:", e);
    process.exit(1);
});

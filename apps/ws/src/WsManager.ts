import { WebSocketServer, WebSocket } from "ws";
import { TickerPayload, ClientMessage, TradePayload, ServerMessage } from "@workspace/types";

export class WsManager {
    private wss: WebSocketServer;
    private subscriptions = new Map<WebSocket, Set<string>>();

    constructor(port: number) {
        this.wss = new WebSocketServer({ port });

        this.wss.on("connection", (socket) => {
            this.subscriptions.set(socket, new Set());

            socket.on("message", (raw) => {
                try {
                    const message = JSON.parse(raw.toString()) as ClientMessage;

                    if (message.method === "SUBSCRIBE") {
                        const current = this.subscriptions.get(socket);
                        if (!current) return;
                        for (const channel of message.params) current.add(channel);
                        return;
                    }

                    if (message.method === "UNSUBSCRIBE") {
                        const current = this.subscriptions.get(socket);
                        if (!current) return;
                        for (const channel of message.params) current.delete(channel);
                    }
                } catch {
                    socket.send(
                        JSON.stringify({
                            type: "error",
                            message: "Invalid WebSocket message"
                        })
                    );
                }
            });

            socket.on("close", () => {
                this.subscriptions.delete(socket);
            });

            socket.send(
                JSON.stringify({
                    type: "connected",
                    message: "WebSocket connected"
                })
            );
        });
    }

    broadcastDepth(symbol: string, data: { bids: [string, string][]; asks: [string, string][] }) {
        this.broadcast(`depth@${symbol}`, {
            type: "depth",
            symbol,
            data
        });
    }

    broadcastTrade(symbol: string, trade: TradePayload["data"]) {
        this.broadcast(`trade@${symbol}`, {
            type: "trade",
            symbol,
            data: trade
        });
    }

    broadcastTicker(symbol: string, ticker: TickerPayload["data"]) {
        this.broadcast(`ticker@${symbol}`, {
            type: "ticker",
            symbol,
            data: ticker
        });
    }

    private broadcast(channel: string, message: ServerMessage) {
        const serialized = JSON.stringify(message);

        for (const [socket, channels] of this.subscriptions.entries()) {
            if (socket.readyState !== WebSocket.OPEN) continue;
            if (!channels.has(channel)) continue;
            socket.send(serialized);
        }
    }
}
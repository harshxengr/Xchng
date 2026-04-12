import { Redis } from "ioredis";
import { prisma } from "@workspace/database";
import type { EngineEvent } from "@workspace/types";

// Redis channels - inline as per junior dev style
const REDIS_CHANNELS = {
  EVENTS: "engine:events",
};

// Create Redis client inline
const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

async function start() {
    await subscriber.subscribe(REDIS_CHANNELS.EVENTS);
    console.log("DB Worker starting. Subscribed to engine events for persistence.");

    subscriber.on("message", async (channel, raw) => {
        try {
            const event = JSON.parse(raw) as EngineEvent;
            
            if (event.type === "TRADE_CREATED") {
                await prisma.$queryRaw`
                    INSERT INTO "Trade" ("id", "tradeId", "market", "price", "quantity", "buyerUserId", "sellerUserId", "timestamp")
                    VALUES (gen_random_uuid(), ${event.data.tradeId}, ${event.data.market}, ${event.data.price.toString()}, ${event.data.quantity.toString()}, ${event.data.buyerUserId}, ${event.data.sellerUserId}, ${new Date(event.data.timestamp)})
                    ON CONFLICT ("market", "tradeId") DO NOTHING
                `;
                console.log(`[DB] Trade saved: ${event.data.tradeId}`);
            } else if (event.type === "TICKER_UPDATED") {
                await prisma.tickerSnapshot.create({
                    data: {
                        market: event.data.market,
                        lastPrice: event.data.lastPrice.toString(),
                        high: event.data.high.toString(),
                        low: event.data.low.toString(),
                        volume: event.data.volume.toString(),
                        quoteVolume: event.data.quoteVolume.toString(),
                        firstPrice: event.data.firstPrice.toString(),
                        priceChange: event.data.priceChange.toString(),
                        priceChangePercent: event.data.priceChangePercent.toString(),
                        trades: event.data.trades,
                        timestamp: new Date(event.data.timestamp)
                    }
                });
            } else if (event.type === "ORDER_UPDATED") {
                await prisma.$queryRaw`
                    UPDATE "Order" SET "filledQuantity" = ${event.data.filledQuantity.toString()}, "status" = ${event.data.status}, "updatedAt" = ${new Date(event.data.timestamp)} WHERE "id" = ${event.data.orderId}
                `;
            }
        } catch (e) {
            console.error("DB worker failed to handle event:", e);
        }
    });
}

start().catch(e => {
    console.error("Critical DB worker failure:", e);
    process.exit(1);
});

import { 
  createRedisClient, 
  REDIS_CHANNELS, 
  saveTickerSnapshot, 
  saveTrades, 
  updateOrderExecution 
} from "@workspace/shared";
import type { EngineEvent } from "@workspace/shared";

const subscriber = createRedisClient();

async function start() {
    await subscriber.subscribe(REDIS_CHANNELS.EVENTS);
    console.log("DB Worker starting. Subscribed to engine events for persistence.");

    subscriber.on("message", async (channel, raw) => {
        try {
            const event = JSON.parse(raw) as EngineEvent;
            
            if (event.type === "TRADE_CREATED") {
                await saveTrades([event.data]);
                console.log(`[DB] Trade saved: ${event.data.tradeId}`);
            } else if (event.type === "TICKER_UPDATED") {
                await saveTickerSnapshot(event.data);
            } else if (event.type === "ORDER_UPDATED") {
                await updateOrderExecution({
                    id: event.data.orderId,
                    filledQuantity: event.data.filledQuantity,
                    status: event.data.status,
                    updatedAt: event.data.timestamp
                });
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

import { 
  createRedisClient, 
  REDIS_CHANNELS, 
  REDIS_KEYS,
  saveOrder,
  markOrderCancelled,
  upsertUserBalances,
  query
} from "@workspace/shared";
import type { 
  EngineCommand, 
  EngineCommandResult, 
  EngineEvent,
} from "@workspace/shared";
import { Engine } from "./trade/Engine.js";

const consumer = createRedisClient();
const publisher = createRedisClient();
const engine = new Engine();

async function start() {
    console.log("Engine simplified worker starting...");

    // Optional: Restore state from DB here if needed. 
    // For now, we'll keep it simple as per the "junior" style.
    
    while (true) {
        // BLPOP is like an async while-loop for Redis lists
        const result = await consumer.blpop(REDIS_CHANNELS.COMMANDS, 0);
        if (!result) continue;

        const [, payload] = result;
        const command = JSON.parse(payload) as EngineCommand;

        try {
            await handleCommand(command);
        } catch (error: any) {
            console.error("Engine command failed:", error);
            await publishRpcResponse(command.requestId, false, undefined, error.message);
        }
    }
}

async function handleCommand(command: EngineCommand) {
    const { type, requestId, payload } = command;

    if (type === "PLACE_ORDER") {
        await engine.ensureUserLoaded(payload.userId);
        const result = engine.placeOrder(payload);

        // PERSIST TO DB
        await saveOrder({
            id: result.orderId,
            market: payload.market,
            userId: payload.userId,
            side: payload.side,
            price: payload.price,
            quantity: payload.quantity,
            filledQuantity: result.executedQty,
            status: result.status,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        
        // Sync balances back to DB for matched users
        const touchedUsers = [payload.userId, ...result.fills.map(f => f.otherUserId)];
        for (const uid of Array.from(new Set(touchedUsers))) {
            await upsertUserBalances(uid, engine.getBalances(uid));
        }

        // Cache depth in Redis
        await publisher.set(REDIS_KEYS.depth(payload.market), JSON.stringify(engine.getDepth(payload.market)));

        // RPC Response
        await publishRpcResponse(requestId, true, result);

        // BROADCAST EVENTS (for WS and DB workers)
        await publishEvent("ORDER_PLACED", payload.market, { ...result, userId: payload.userId });
        
        for (const fill of result.fills) {
            await publishEvent("ORDER_UPDATED", payload.market, { 
                orderId: fill.makerOrderId, 
                userId: fill.otherUserId, 
                filledQuantity: fill.makerFilledQuantity, 
                status: fill.makerStatus 
            });
            await publishEvent("TRADE_CREATED", payload.market, {
                tradeId: fill.tradeId,
                price: fill.price,
                quantity: fill.qty,
                buyerUserId: payload.side === "buy" ? payload.userId : fill.otherUserId,
                sellerUserId: payload.side === "sell" ? payload.userId : fill.otherUserId,
                timestamp: Date.now()
            });
        }

    } else if (type === "CANCEL_ORDER") {
        const result = engine.cancelOrder(payload.market, payload.orderId);
        
        await markOrderCancelled({
            id: payload.orderId,
            filledQuantity: result.executedQty,
            updatedAt: Date.now()
        });
        
        await upsertUserBalances(payload.userId, engine.getBalances(payload.userId));
        await publisher.set(REDIS_KEYS.depth(payload.market), JSON.stringify(engine.getDepth(payload.market)));

        await publishRpcResponse(requestId, true, result);
        await publishEvent("ORDER_CANCELLED", payload.market, { ...result, userId: payload.userId });

    } else if (type === "DEPOSIT") {
        await engine.ensureUserLoaded(payload.userId);
        engine.deposit(payload.userId, payload.asset, payload.amount);
        
        const balances = engine.getBalances(payload.userId);
        await upsertUserBalances(payload.userId, balances);
        
        await publishRpcResponse(requestId, true, { success: true, balances });
        await publishEvent("BALANCES_UPDATED", undefined, { userId: payload.userId, timestamp: Date.now() });
    }
}

async function publishRpcResponse(requestId: string, ok: boolean, data?: any, error?: string) {
    await publisher.publish(REDIS_CHANNELS.rpcResponse(requestId), JSON.stringify({ requestId, ok, data, error }));
}

async function publishEvent(type: string, market: string | undefined, data: any) {
    await publisher.publish(REDIS_CHANNELS.EVENTS, JSON.stringify({ type, market, data }));
}

start().catch(e => {
    console.error("Critical engine failure:", e);
    process.exit(1);
});

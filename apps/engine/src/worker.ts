import { Redis } from "ioredis";
import { prisma } from "@workspace/database";
import type { 
  EngineCommand, 
  EngineCommandResult, 
  EngineEvent,
} from "@workspace/types";
import { env } from "@workspace/env/server";
import { Engine } from "./trade/Engine.js";

// Redis channels - inline as per junior dev style
const REDIS_CHANNELS = {
  COMMANDS: "engine:commands",
  EVENTS: "engine:events",
  rpcResponse: (requestId: string) => `rpc.response.${requestId}`,
};

const REDIS_KEYS = {
  depth: (market: string) => `depth:${market}`,
};

// Create Redis clients inline
const consumer = new Redis(env.REDIS_URL || "redis://localhost:6379");
const publisher = new Redis(env.REDIS_URL || "redis://localhost:6379");
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

        // PERSIST TO DB using Prisma raw SQL
        await prisma.$queryRaw`
            INSERT INTO "Order" ("id", "market", "userId", "side", "price", "quantity", "filledQuantity", "status", "createdAt", "updatedAt")
            VALUES (${result.orderId}, ${payload.market}, ${payload.userId}, ${payload.side}, ${payload.price.toString()}, ${payload.quantity.toString()}, ${result.executedQty.toString()}, ${result.status}, ${new Date()}, ${new Date()})
        `;
        
        // Sync balances back to DB for matched users
        const touchedUsers = [payload.userId, ...result.fills.map((f: any) => f.otherUserId)];
        for (const uid of Array.from(new Set(touchedUsers))) {
            const balances = engine.getBalances(uid);
            for (const [asset, bal] of Object.entries(balances)) {
                const balance = bal as { available: number; locked: number };
                await prisma.$queryRaw`
                    INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
                    VALUES (gen_random_uuid(), ${uid}, ${asset}, ${balance.available.toString()}, ${balance.locked.toString()})
                    ON CONFLICT ("userId", "asset") DO UPDATE SET "available" = ${balance.available.toString()}, "locked" = ${balance.locked.toString()}
                `;
            }
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
                market: payload.market, // Added for DB Worker
                filledQuantity: fill.makerFilledQuantity, 
                status: fill.makerStatus 
            });
            await publishEvent("TRADE_CREATED", payload.market, {
                tradeId: fill.tradeId,
                market: payload.market, // Added for DB Worker consistency
                price: fill.price,
                quantity: fill.qty,
                buyerUserId: payload.side === "buy" ? payload.userId : fill.otherUserId,
                sellerUserId: payload.side === "sell" ? payload.userId : fill.otherUserId,
                timestamp: Date.now()
            });
        }

        // Broadcast Ticker Update
        const ticker = engine.getTicker(payload.market);
        await publishEvent("TICKER_UPDATED", payload.market, {
            ...ticker,
            market: payload.market,
            timestamp: Date.now()
        });

    } else if (type === "CANCEL_ORDER") {
        const result = engine.cancelOrder(payload.market, payload.orderId);

        await prisma.$queryRaw`
            UPDATE "Order" SET "filledQuantity" = ${result.executedQty.toString()}, "status" = 'CANCELLED', "updatedAt" = ${new Date()} WHERE "id" = ${payload.orderId}
        `;

        const balances = engine.getBalances(payload.userId);
        for (const [asset, bal] of Object.entries(balances)) {
            const balance = bal as { available: number; locked: number };
            await prisma.$queryRaw`
                INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
                VALUES (gen_random_uuid(), ${payload.userId}, ${asset}, ${balance.available.toString()}, ${balance.locked.toString()})
                ON CONFLICT ("userId", "asset") DO UPDATE SET "available" = ${balance.available.toString()}, "locked" = ${balance.locked.toString()}
            `;
        }
        await publisher.set(REDIS_KEYS.depth(payload.market), JSON.stringify(engine.getDepth(payload.market)));

        await publishRpcResponse(requestId, true, result);
        await publishEvent("ORDER_CANCELLED", payload.market, { ...result, userId: payload.userId });

    } else if (type === "DEPOSIT") {
        await engine.ensureUserLoaded(payload.userId);
        engine.deposit(payload.userId, payload.asset, payload.amount);

        const balances = engine.getBalances(payload.userId);
        for (const [asset, bal] of Object.entries(balances)) {
            const balance = bal as { available: number; locked: number };
            await prisma.$queryRaw`
                INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
                VALUES (gen_random_uuid(), ${payload.userId}, ${asset}, ${balance.available.toString()}, ${balance.locked.toString()})
                ON CONFLICT ("userId", "asset") DO UPDATE SET "available" = ${balance.available.toString()}, "locked" = ${balance.locked.toString()}
            `;
        }

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

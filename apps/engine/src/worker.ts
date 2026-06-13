import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import * as database from "@workspace/database";
import type { 
  EngineCommand, 
} from "@workspace/types";
import * as serverEnv from "@workspace/env/server";
import { closeRedisClient, createRedisClient, logger, registerShutdown } from "@workspace/runtime";
import { Engine } from "./trade/Engine.js";

const prisma = database.prisma ?? database.default?.prisma;
const env = serverEnv.env ?? serverEnv.default?.env;

const REDIS_CHANNELS = {
  COMMANDS: "engine:commands",
  EVENTS: "engine:events",
  rpcResponse: (requestId: string) => `rpc.response.${requestId}`,
};

const REDIS_KEYS = {
  depth: (market: string) => `depth:${market}`,
};

const consumer = createRedisClient(env.REDIS_URL, "consumer", "engine");
const publisher = createRedisClient(env.REDIS_URL, "publisher", "engine");
const engine = new Engine();
let shutdownRequested = false;

export async function startEngine() {
    logger.info("Engine worker starting");
    await engine.init();
    logger.info("Engine state initialized from DB");
    
    while (!shutdownRequested) {
        const result = await consumer.blpop(REDIS_CHANNELS.COMMANDS, 5);
        if (!result) continue;

        const [, payload] = result;
        let command: EngineCommand;
        try {
            command = JSON.parse(payload) as EngineCommand;
        } catch (error) {
            logger.warn("Invalid engine command payload", { error });
            continue;
        }

        logger.info("Engine command received", { type: command.type, requestId: command.requestId });

        try {
            await handleCommand(command);
        } catch (error) {
            logger.error("Engine command failed", { type: command.type, requestId: command.requestId, error });
            await publishRpcResponse(command.requestId, false, undefined, error instanceof Error ? error.message : "Engine error");
        }
    }
}

export async function stopEngine() {
    shutdownRequested = true;
    await Promise.all([closeRedisClient(consumer), closeRedisClient(publisher)]);
}

async function handleCommand(command: EngineCommand) {
    const { type, requestId, payload } = command;

    if (type === "PLACE_ORDER") {
        await engine.ensureUserLoaded(payload.userId);
        const result = engine.placeOrder(payload);

        const depth = engine.getDepth(payload.market);
        const ticker = engine.getTicker(payload.market);

        await publisher.set(REDIS_KEYS.depth(payload.market), JSON.stringify(depth));

        await publishEvent("DEPTH_UPDATED", payload.market, depth);
        await publishEvent("TICKER_UPDATED", payload.market, { ...ticker, market: payload.market, timestamp: Date.now() });
        
        for (const fill of result.fills) {
            await publishEvent("TRADE_CREATED", payload.market, {
                tradeId: fill.tradeId,
                market: payload.market,
                price: fill.price,
                quantity: fill.qty,
                buyerUserId: payload.side === "buy" ? payload.userId : fill.otherUserId,
                sellerUserId: payload.side === "sell" ? payload.userId : fill.otherUserId,
                timestamp: Date.now()
            });
        }
        await publishEvent("ORDER_PLACED", payload.market, { ...result, userId: payload.userId });

        await prisma.$queryRaw`
            INSERT INTO "Order" ("id", "market", "userId", "side", "orderType", "price", "quantity", "filledQuantity", "status", "createdAt", "updatedAt")
            VALUES (${result.orderId}, ${payload.market}, ${payload.userId}, ${payload.side}, ${payload.orderType || "limit"}, ${payload.price.toString()}, ${payload.quantity.toString()}, ${result.executedQty.toString()}, ${result.status}, ${new Date()}, ${new Date()})
        `;
        
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

        for (const fill of result.fills) {
            await prisma.$queryRaw`
                UPDATE "Order" SET "filledQuantity" = ${fill.makerFilledQuantity.toString()}, "status" = ${fill.makerStatus}, "updatedAt" = ${new Date()} WHERE "id" = ${fill.makerOrderId}
            `;
            await publishEvent("ORDER_UPDATED", payload.market, { 
                orderId: fill.makerOrderId, 
                userId: fill.otherUserId, 
                market: payload.market,
                filledQuantity: fill.makerFilledQuantity, 
                status: fill.makerStatus,
                timestamp: Date.now()
            });
        }

        await publishRpcResponse(requestId, true, result);

    } else if (type === "CANCEL_ORDER") {
        const result = engine.cancelOrder(payload.market, payload.orderId);

        const depth = engine.getDepth(payload.market);
        await publisher.set(REDIS_KEYS.depth(payload.market), JSON.stringify(depth));

        await publishRpcResponse(requestId, true, result);
        await publishEvent("DEPTH_UPDATED", payload.market, depth);
        await publishEvent("ORDER_CANCELLED", payload.market, { ...result, userId: payload.userId });

        (async () => {
            try {
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
            } catch (dbError) {
                logger.error("Delayed DB persistence error", { command: "CANCEL_ORDER", error: dbError });
            }
        })();

    } else if (type === "DEPOSIT") {
        await engine.ensureUserLoaded(payload.userId);
        engine.deposit(payload.userId, payload.asset, payload.amount);

        const balances = engine.getBalances(payload.userId);
        for (const [asset, bal] of Object.entries(balances)) {
            const balance = bal as { available: number; locked: number };
            await prisma.$queryRaw`
                INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
                VALUES (${crypto.randomUUID()}, ${payload.userId}, ${asset}, ${balance.available.toString()}, ${balance.locked.toString()})
                ON CONFLICT ("userId", "asset") DO UPDATE SET "available" = ${balance.available.toString()}, "locked" = ${balance.locked.toString()}
            `;
        }

        logger.info("Deposit successful", { userId: payload.userId, amount: payload.amount, asset: payload.asset });
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

function isMainModule(metaUrl: string): boolean {
    const entry = process.argv[1];
    if (!entry) {
        return false;
    }
    return path.resolve(fileURLToPath(metaUrl)) === path.resolve(entry);
}

if (isMainModule(import.meta.url)) {
    registerShutdown("engine", stopEngine);
    startEngine().catch((e) => {
        logger.error("Critical engine failure", { error: e });
        process.exit(1);
    });
}

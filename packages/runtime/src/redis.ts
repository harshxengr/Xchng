import { Redis } from "ioredis";
import { logger } from "./logger.js";

type RedisRole = "publisher" | "subscriber" | "consumer" | "cache";

export function createRedisClient(url: string, role: RedisRole, service = "runtime") {
  const client = new Redis(url, {
    connectionName: `xchng:${service}:${role}`,
    enableReadyCheck: true,
    maxRetriesPerRequest: role === "consumer" ? null : 3,
    retryStrategy(times) {
      return Math.min(1000 + times * 250, 10_000);
    },
    reconnectOnError(error) {
      const message = error.message.toLowerCase();
      return message.includes("readonly") || message.includes("connection") || message.includes("timeout");
    },
  });

  client.on("connect", () => logger.info("Redis connection opened", { role, service }));
  client.on("ready", () => logger.info("Redis connection ready", { role, service }));
  client.on("reconnecting", () => logger.warn("Redis reconnecting", { role, service }));
  client.on("error", (error) => logger.error("Redis error", { role, service, error }));

  return client;
}

export async function closeRedisClient(client: Redis | null | undefined) {
  if (!client) {
    return;
  }

  try {
    await client.quit();
  } catch (error) {
    logger.warn("Redis quit failed, disconnecting", { error });
    client.disconnect();
  }
}

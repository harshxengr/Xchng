import { Redis } from "ioredis";
import pg from "pg";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// --- ENV INITIALIZATION ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPaths = [
  resolve(__dirname, "../../../.env.local"),
  resolve(__dirname, "../../../.env"),
].filter(existsSync);

if (envPaths.length > 0) {
  config({ path: envPaths[0], override: true });
}

// --- CORE TYPES ---
export type Side = "buy" | "sell";

export interface PlaceOrderInput {
  market: string;
  userId: string;
  side: Side;
  price: number;
  quantity: number;
}

export interface Order {
  orderId: string;
  userId: string;
  side: Side;
  price: number;
  quantity: number;
  filled: number;
}

export interface Trade {
  tradeId: number;
  market: string;
  price: number;
  quantity: number;
  buyerUserId: string;
  sellerUserId: string;
  timestamp: number;
}

export interface Ticker {
  symbol: string;
  lastPrice: string;
  high: string;
  low: string;
  volume: string;
  quoteVolume: string;
  firstPrice: string;
  priceChange: string;
  priceChangePercent: string;
  trades: number;
}

export interface EngineCommand {
  requestId: string;
  type: "PLACE_ORDER" | "CANCEL_ORDER" | "DEPOSIT";
  payload: any;
}

export interface EngineCommandResult<T = any> {
  requestId: string;
  ok: boolean;
  data?: T;
  error?: string;
}

export interface EngineEvent {
  type: string;
  market?: string;
  data: any;
}

export interface Fill {
  tradeId: number;
  orderId: string;
  otherUserId: string;
  price: number;
  qty: number;
  makerOrderId: string;
  makerFilledQuantity: number;
  makerStatus: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
}

export interface PlaceOrderResult {
  orderId: string;
  executedQty: number;
  fills: Fill[];
  status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
  remainingQty: number;
}

export interface CancelOrderResult {
  orderId: string;
  remainingQty: number;
  executedQty: number;
}

export interface AssetBalance {
  available: number;
  locked: number;
}

export type UserBalance = Record<string, AssetBalance>;

// --- REDIS HELPERS ---
export const REDIS_CHANNELS = {
  COMMANDS: "engine:commands",
  EVENTS: "engine:events",
  rpcResponse: (requestId: string) => `rpc.response.${requestId}`,
};

export const REDIS_KEYS = {
  depth: (market: string) => `depth:${market}`,
  mmBotStatus: (market: string) => `mmbot:status:${market}`,
  mmBotControl: (market: string) => `mmbot:control:${market}`,
};

export function createRedisClient() {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379");
}

// --- DATABASE HELPERS ---
const { Pool } = pg;
let poolInstance: pg.Pool | null = null;

export function getPool() {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres",
      max: 20,
    });
  }
  return poolInstance;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query(text, params);
  return res.rows;
}

// Simplified DB Operations (one place for all SQL)
import { randomUUID } from "node:crypto";

export async function saveOrder(order: any) {
  await query(
    `INSERT INTO "Order" ("id", "market", "userId", "side", "price", "quantity", "filledQuantity", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      order.id, order.market, order.userId, order.side, 
      order.price.toString(), order.quantity.toString(), 
      order.filledQuantity.toString(), order.status, 
      new Date(order.createdAt), new Date(order.updatedAt)
    ]
  );
}

export async function getOrderById(id: string) {
  const rows = await query(`SELECT * FROM "Order" WHERE "id" = $1`, [id]);
  return rows[0] || null;
}

export async function markOrderCancelled(params: { id: string; filledQuantity: number; updatedAt: number }) {
  await query(
    `UPDATE "Order" SET "status" = 'CANCELLED', "filledQuantity" = $1, "updatedAt" = $2 WHERE "id" = $3`,
    [params.filledQuantity.toString(), new Date(params.updatedAt), params.id]
  );
}

export async function upsertUserBalances(userId: string, balances: Record<string, { available: number; locked: number }>) {
  for (const [asset, bal] of Object.entries(balances)) {
    await query(
      `INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked") VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("userId", "asset") DO UPDATE SET "available" = EXCLUDED."available", "locked" = EXCLUDED."locked"`,
      [randomUUID(), userId, asset, bal.available.toString(), bal.locked.toString()]
    );
  }
}

export async function ensureAndLoadBalances(userId: string) {
  let balances = await query(`SELECT * FROM "Balance" WHERE "userId" = $1`, [userId]);
  
  if (balances.length === 0) {
    const defaultAssets = ["TATA", "INR"];
    for (const asset of defaultAssets) {
      await query(
        `INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked") VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), userId, asset, "0", "0"]
      );
    }
    balances = await query(`SELECT * FROM "Balance" WHERE "userId" = $1`, [userId]);
  }
  
  const result: Record<string, { available: number; locked: number }> = {};
  for (const b of balances) {
    result[b.asset] = { available: Number(b.available), locked: Number(b.locked) };
  }
  return result;
}

export async function saveTrades(trades: any[]) {
  for (const t of trades) {
    await query(
      `INSERT INTO "Trade" ("id", "tradeId", "market", "price", "quantity", "buyerUserId", "sellerUserId", "timestamp") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("market", "tradeId") DO NOTHING`,
      [randomUUID(), t.tradeId, t.market, t.price.toString(), t.quantity.toString(), t.buyerUserId, t.sellerUserId, new Date(t.timestamp)]
    );
  }
}

export async function saveTickerSnapshot(t: any) {
  await query(
    `INSERT INTO "TickerSnapshot" ("id", "market", "lastPrice", "high", "low", "volume", "quoteVolume", "firstPrice", "priceChange", "priceChangePercent", "trades", "timestamp")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [randomUUID(), t.market, t.lastPrice.toString(), t.high.toString(), t.low.toString(), t.volume.toString(), t.quoteVolume.toString(), t.firstPrice.toString(), t.priceChange.toString(), t.priceChangePercent.toString(), t.trades, new Date(t.timestamp)]
  );
}

export async function updateOrderExecution(update: any) {
  await query(
    `UPDATE "Order" SET "filledQuantity" = $1, "status" = $2, "updatedAt" = $3 WHERE "id" = $4`,
    [update.filledQuantity.toString(), update.status, new Date(update.updatedAt), update.id]
  );
}

export async function getOpenOrdersForUser(market: string, userId: string) {
  return await query(
    `SELECT * FROM "Order" WHERE "market" = $1 AND "userId" = $2 AND "status" IN ('OPEN', 'PARTIALLY_FILLED') ORDER BY "createdAt" ASC`,
    [market, userId]
  );
}

export async function getRecentTrades(market: string) {
  return await query(
    `SELECT * FROM "Trade" WHERE "market" = $1 ORDER BY "timestamp" DESC LIMIT 50`,
    [market]
  );
}

export async function getLatestTickers() {
  return await query(
    `SELECT DISTINCT ON ("market") * FROM "TickerSnapshot" ORDER BY "market", "timestamp" DESC`
  );
}

export async function getLatestTickerByMarket(market: string) {
  const rows = await query(
    `SELECT * FROM "TickerSnapshot" WHERE "market" = $1 ORDER BY "timestamp" DESC LIMIT 1`,
    [market]
  );
  return rows[0] || null;
}

export async function getOrderHistory(params: { userId?: string; market?: string; limit?: number }) {
  let q = `SELECT * FROM "Order" WHERE 1=1`;
  const p: any[] = [];
  if (params.userId) { p.push(params.userId); q += ` AND "userId" = $${p.length}`; }
  if (params.market) { p.push(params.market); q += ` AND "market" = $${p.length}`; }
  q += ` ORDER BY "createdAt" DESC LIMIT ${params.limit || 50}`;
  return await query(q, p);
}

export async function getKlines(params: { market: string; interval: string; limit?: number }) {
  const limit = params.limit || 120;
  const rows = await query(
    `SELECT * FROM "Kline" WHERE "market" = $1 AND "interval" = $2 ORDER BY "bucketStart" DESC LIMIT $3`,
    [params.market, params.interval, limit]
  );
  return rows.reverse().map(r => ({
    ...r,
    bucketStart: (r.bucketStart as Date).getTime()
  }));
}

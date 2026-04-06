import { prisma } from "@workspace/database";
import type { PersistedTradeInput } from "@workspace/types";
import { toTradeCreateManyInput } from "./mappers.js";


export async function saveTrades(trades: PersistedTradeInput[]) {
    if (trades.length === 0) return;

    await prisma.trade.createMany({
        data: trades.map(toTradeCreateManyInput),
        skipDuplicates: true
    });
}

export async function getRecentTrades(market: string, limit = 50) {
    return prisma.trade.findMany({
        where: { market },
        orderBy: { timestamp: "desc" },
        take: limit
    });
}
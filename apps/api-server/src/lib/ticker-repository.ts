import { prisma } from "@workspace/database";
import type { PersistedTickerInput } from "@workspace/types";
import { toTickerCreateInput } from "./mappers.js";

export async function saveTickerSnapshot(ticker: PersistedTickerInput) {
    await prisma.tickerSnapshot.create({
        data: toTickerCreateInput(ticker)
    });
}

export async function getLatestTickers() {
    return prisma.tickerSnapshot.findMany({
        orderBy: { timestamp: "desc" }
    });
}
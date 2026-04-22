import { prisma } from '../packages/database/src/index';

const MARKETS = ["TATA_INR", "RELI_INR", "INFY_INR", "SBIN_INR", "AAPL_USD", "GOOG_USD", "BTC_USDT"];
const USER_ID = "test-user-1";

async function main() {
    console.log("Seeding fake data for markets...");

    for (const market of MARKETS) {
        const basePrice = market.includes("BTC") ? 65000 : market.includes("USD") ? 150 : 500;
        
        // 1. Clear existing data for these markets to avoid constraint issues
        console.log(`Cleaning old data for ${market}...`);
        await prisma.$queryRaw`DELETE FROM "Trade" WHERE "market" = ${market}`;
        await prisma.$queryRaw`DELETE FROM "TickerSnapshot" WHERE "market" = ${market}`;

        // 2. Create balances if they don't exist
        const [base, quote] = market.split("_");
        const assets = [base, quote];
        for (const asset of assets) {
            await prisma.$queryRaw`
                INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked")
                VALUES (gen_random_uuid(), ${USER_ID}, ${asset}, '1000000', '0')
                ON CONFLICT DO NOTHING
            `;
        }

        // 3. Create some fake trades (last 24 hours)
        console.log(`Seeding trades for ${market}...`);
        for (let i = 0; i < 50; i++) {
            const price = basePrice + (Math.random() - 0.5) * (basePrice * 0.1);
            const qty = Math.random() * 10;
            const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
            
            await prisma.$queryRaw`
                INSERT INTO "Trade" ("id", "tradeId", "market", "price", "quantity", "buyerUserId", "sellerUserId", "timestamp")
                VALUES (gen_random_uuid(), ${i + 1}, ${market}, ${price.toFixed(2)}, ${qty.toFixed(4)}, 'user1', 'user2', ${timestamp})
            `;
        }

        // 4. Create multiple ticker snapshots for the last 24h to show "activity"
        console.log(`Seeding ticker snapshots for ${market}...`);
        for (let j = 0; j < 10; j++) {
            const lastPrice = basePrice + (Math.random() - 0.5) * (basePrice * 0.05);
            const timestamp = new Date(Date.now() - (10 - j) * 2 * 60 * 60 * 1000); // Every 2 hours
            await prisma.tickerSnapshot.create({
                data: {
                    market,
                    lastPrice: lastPrice.toFixed(2),
                    high: (lastPrice * 1.05).toFixed(2),
                    low: (lastPrice * 0.95).toFixed(2),
                    volume: (Math.random() * 1000).toFixed(2),
                    quoteVolume: (Math.random() * 100000).toFixed(2),
                    firstPrice: (lastPrice * 0.98).toFixed(2),
                    priceChange: (lastPrice * 0.02).toFixed(2),
                    priceChangePercent: ((Math.random() - 0.5) * 10).toFixed(2),
                    trades: 50,
                    timestamp: timestamp
                }
            });
        }
    }

    console.log("Seeding complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

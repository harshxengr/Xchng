
import { prisma } from '../packages/database/src/index';

async function main() {
    const orders = await prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });
    console.log("Last 10 orders:", JSON.stringify(orders, null, 2));

    const btcOrders = await prisma.order.findMany({
        where: { market: 'BTC_USDT', status: 'OPEN' }
    });
    console.log(`Total OPEN BTC_USDT orders: ${btcOrders.length}`);
}

main().finally(() => prisma.$disconnect());

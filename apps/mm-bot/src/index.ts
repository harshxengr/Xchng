import { createRedisClient, REDIS_KEYS } from "@workspace/shared";

// --- CONFIGURATION (Direct from process.env) ---
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const MARKETS = (process.env.MM_MARKETS || "TATA_INR").split(",").map(m => m.trim());
const LOOP_INTERVAL = parseInt(process.env.MM_LOOP_INTERVAL_MS || "5000");

const redis = createRedisClient();

/**
 * Simplified Market Maker Bot.
 * It periodically checks the price and places a ladder of buy/sell orders.
 */
async function runMarketLoop(market: string) {
    const userId = `mm-${market.toLowerCase()}`;
    console.log(`[MM-BOT] Starting loop for ${market} as ${userId}`);

    while (true) {
        try {
            // 1. Get current market state
            const tickerRes = await fetch(`${API_URL}/ticker?symbol=${market}`);
            const ticker = await tickerRes.json();
            const price = parseFloat(ticker.lastPrice) || 100;

            // 2. Get our existing orders
            const ordersRes = await fetch(`${API_URL}/order/open?market=${market}&userId=${userId}`);
            const existingOrders = await ordersRes.json();

            // 3. Cancel all our old orders to keep it simple (junior style)
            // A more advanced dev would only cancel if price moved, but this is fine for a demo.
            for (const order of existingOrders) {
                await fetch(`${API_URL}/order`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ market, orderId: order.orderId, userId })
                });
            }

            // 4. Place a new ladder (1 buy, 1 sell for simplicity)
            const spread = 0.01; // 1%
            await placeOrder(market, userId, "buy", price * (1 - spread), 1);
            await placeOrder(market, userId, "sell", price * (1 + spread), 1);

            console.log(`[MM-BOT] ${market} updated. Ref price: ${price}`);
        } catch (e) {
            console.error(`[MM-BOT] ${market} loop error:`, e);
        }

        await new Promise(r => setTimeout(r, LOOP_INTERVAL));
    }
}

async function placeOrder(market: string, userId: string, side: string, price: number, quantity: number) {
    await fetch(`${API_URL}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, userId, side, price, quantity })
    });
}

function start() {
    MARKETS.forEach(runMarketLoop);
}

start();

import { Client } from 'pg';
import axios from 'axios';
import { randomUUID } from 'crypto';

let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/xchng';

async function runTest() {
    console.log('--- Starting Smoke Test ---');

    console.log('1. Verifying API Health...');
    let health;
    const portsToTry = [4000, 4001, 40001, 40002, 40003, 40004, 40005];
    for (const port of portsToTry) {
        const candidateUrl = `http://localhost:${port}`;
        const healthUrl = `${candidateUrl}/health`;
        try {
            health = await axios.get(healthUrl);
            if (health.status === 200) {
                API_URL = `${candidateUrl}/api/v1`;
                console.log(`   Connected to API on port ${port}`);
                break;
            }
        } catch (e) {
            // continue
        }
    }

    if (!health || health.status !== 200) {
        console.error('   API Health check failed on all ports! Is api-server running?');
        process.exit(1);
    }
    console.log('   Health Status:', health?.status, health?.data);

    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    console.log('2. Resetting Balances for test users...');
    // Split into individual queries to avoid prepared statement multi-command error
    await client.query(`INSERT INTO "user" (id, email, name) VALUES ('1', 'user1@example.com', 'User One') ON CONFLICT (email) DO NOTHING`);
    await client.query(`INSERT INTO "user" (id, email, name) VALUES ('2', 'user2@example.com', 'User Two') ON CONFLICT (email) DO NOTHING`);
    
    await client.query(`
        INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked") 
        VALUES ($1, '1', 'INR', '1000000', '0') ON CONFLICT ("userId", "asset") DO UPDATE SET available = '1000000'
    `, [randomUUID()]);
    
    await client.query(`
        INSERT INTO "Balance" ("id", "userId", "asset", "available", "locked") 
        VALUES ($1, '2', 'BTC', '1000', '0') ON CONFLICT ("userId", "asset") DO UPDATE SET available = '1000'
    `, [randomUUID()]);

    console.log('3. Placing Buy Order (User 1)...');
    try {
        const buyOrder = await axios.post(`${API_URL}/order`, {
            market: 'BTC_INR',
            userId: '1',
            side: 'buy',
            price: '50000',
            quantity: '0.1'
        });
        console.log('   Buy Order placed:', buyOrder.data);
    } catch (e: any) {
        console.error('   Buy Order failed:', e.response?.data || e.message);
        process.exit(1);
    }

    console.log('4. Placing Sell Order (User 2)...');
    try {
        const sellOrder = await axios.post(`${API_URL}/order`, {
            market: 'BTC_INR',
            userId: '2',
            side: 'sell',
            price: '50000',
            quantity: '0.1'
        });
        console.log('   Sell Order placed:', sellOrder.data);
    } catch (e: any) {
        console.error('   Sell Order failed:', e.response?.data || e.message);
        process.exit(1);
    }

    console.log('5. Waiting for Engine and DB Worker (5 seconds)...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('6. Verifying Trade Persistence...');
    const tradeResult = await client.query('SELECT * FROM "Trade" WHERE market = $1 ORDER BY timestamp DESC LIMIT 1', ['BTC_INR']);
    if (tradeResult.rows.length > 0) {
        console.log('   MATCH FOUND! Trade persisted:', tradeResult.rows[0]);
    } else {
        console.error('   FAILED: No trade found in database. Check engine and db-worker logs.');
        process.exit(1);
    }

    console.log('7. Verifying Balance Updates...');
    const user1Btc = await client.query('SELECT available FROM "Balance" WHERE "userId" = $1 AND asset = $2', ['1', 'BTC']);
    const user2Inr = await client.query('SELECT available FROM "Balance" WHERE "userId" = $1 AND asset = $2', ['2', 'INR']);

    console.log('   User 1 BTC Available:', user1Btc.rows[0]?.available);
    console.log('   User 2 INR Available:', user2Inr.rows[0]?.available);

    if (Number(user1Btc.rows[0]?.available) > 0 && Number(user2Inr.rows[0]?.available) > 0) {
        console.log('   SUCCESS: Balances updated correctly.');
    } else {
        console.error('   FAILED: Balances not updated as expected.');
        process.exit(1);
    }

    await client.end();
    console.log('--- Smoke Test Passed ---');
}

runTest().catch(console.error);

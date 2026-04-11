const API_URL = "http://localhost:4000/api/v1";

async function test() {
    console.log("--- Starting Exchange Verification ---");

    const userA = "user-test-a";
    const userB = "user-test-b";
    const market = "TATA_INR";

    // 1. Initial Deposits
    console.log("1. Depositing funds...");
    await fetch(`${API_URL}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userA, asset: "INR", amount: 1000 })
    });
    await fetch(`${API_URL}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userB, asset: "TATA", amount: 10 })
    });

    // 2. Check initial balances
    const balARes = await fetch(`${API_URL}/balances?userId=${userA}`);
    const balA = await balARes.json();
    console.log(`User A (INR): ${balA.INR?.available}`);

    const balBRes = await fetch(`${API_URL}/balances?userId=${userB}`);
    const balB = await balBRes.json();
    console.log(`User B (TATA): ${balB.TATA?.available}`);

    // 3. User A places Buy order (1 TATA at 50 INR)
    console.log("3. User A placing Buy order...");
    const buyRes = await fetch(`${API_URL}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, userId: userA, side: "buy", price: 50, quantity: 1 })
    });
    const buyOrder = await buyRes.json();
    console.log(`Buy Order ID: ${buyOrder.orderId}, Status: ${buyOrder.status}`);

    // 4. User B places matching Sell order (1 TATA at 50 INR)
    console.log("4. User B placing Sell order (match)...");
    const sellRes = await fetch(`${API_URL}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, userId: userB, side: "sell", price: 50, quantity: 1 })
    });
    const sellOrder = await sellRes.json();
    console.log(`Sell Order ID: ${sellOrder.orderId}, Status: ${sellOrder.status}`);
    console.log(`Fills: ${sellOrder.fills.length}`);

    // Wait for DB-worker to persist
    console.log("Waiting for persistence...");
    await new Promise(r => setTimeout(r, 2000));

    // 5. Final Balance Checks
    const finalARes = await fetch(`${API_URL}/balances?userId=${userA}`);
    const finalA = await finalARes.json();
    console.log(`Final User A: INR=${finalA.INR.available}, TATA=${finalA.TATA.available}`);

    const finalBRes = await fetch(`${API_URL}/balances?userId=${userB}`);
    const finalB = await finalBRes.json();
    console.log(`Final User B: INR=${finalB.INR.available}, TATA=${finalB.TATA.available}`);

    if (finalA.TATA.available === 1 && finalB.INR.available === 50) {
        console.log("✅ MATCH SUCCESSFUL AND BALANCES UPDATED!");
    } else {
        console.error("❌ MATCH FAILED!");
        process.exit(1);
    }
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});

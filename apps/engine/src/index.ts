import { Engine } from "./trade/Engine.js";

function main(): void {
    const engine = new Engine();

    console.log("Initial balances user 1:", engine.getBalances("1"));
    console.log("Initial balances user 2:", engine.getBalances("2"));

    const sell = engine.placeOrder({
        market: "TATA_INR",
        userId: "2",
        side: "sell",
        price: 100,
        quantity: 10
    });

    console.log("User 2 placed sell:", sell);
    console.log("Depth after sell:", engine.getDepth("TATA_INR"));

    const buy = engine.placeOrder({
        market: "TATA_INR",
        userId: "1",
        side: "buy",
        price: 100,
        quantity: 5
    });

    console.log("User 1 placed buy:", buy);
    console.log("Depth after buy:", engine.getDepth("TATA_INR"));

    console.log("User 1 balances:", engine.getBalances("1"));
    console.log("User 2 balances:", engine.getBalances("2"));
    console.log("User 2 open orders:", engine.getOpenOrders("TATA_INR", "2"));
}

main();

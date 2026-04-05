import { describe, expect, it } from "vitest";
import { Engine } from "../trade/Engine.js";

describe("Engine", () => {
  it("places a sell order on the book when there is no matching buyer", () => {
    const engine = new Engine();

    const result = engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 10
    });

    expect(result.executedQty).toBe(0);
    expect(result.fills).toEqual([]);

    const depth = engine.getDepth("TATA_INR");
    expect(depth.asks).toEqual([["100", "10"]]);
    expect(depth.bids).toEqual([]);
  });

  it("locks seller base asset when placing a sell order", () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 10
    });

    const balances = engine.getBalances("2");
    expect(balances.TATA?.available).toBe(990);
    expect(balances.TATA?.locked).toBe(10);
  });

  it("matches a buy order against an existing sell order", () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 10
    });

    const result = engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 5
    });

    expect(result.executedQty).toBe(5);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]).toMatchObject({
      price: 100,
      qty: 5,
      otherUserId: "2"
    });

    const depth = engine.getDepth("TATA_INR");
    expect(depth.asks).toEqual([["100", "5"]]);
  });

  it("updates buyer and seller balances after a trade", () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 10
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 5
    });

    const buyer = engine.getBalances("1");
    const seller = engine.getBalances("2");

    expect(buyer.TATA?.available).toBe(1005);
    expect(buyer.INR?.available).toBe(999500);
    expect(buyer.INR?.locked).toBe(0);

    expect(seller.TATA?.available).toBe(990);
    expect(seller.TATA?.locked).toBe(5);
    expect(seller.INR?.available).toBe(1_000_500);
  });

  it("keeps remaining buy quantity on the book if partially filled", () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 3
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 10
    });

    const depth = engine.getDepth("TATA_INR");
    expect(depth.asks).toEqual([]);
    expect(depth.bids).toEqual([["100", "7"]]);

    const buyer = engine.getBalances("1");
    expect(buyer.INR?.locked).toBe(700);
    expect(buyer.TATA?.available).toBe(1003);
  });

  it("refunds extra locked quote balance when buy executes at a better price", () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 90,
      quantity: 2
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 2
    });

    const buyer = engine.getBalances("1");

    expect(buyer.INR?.available).toBe(999820);
    expect(buyer.INR?.locked).toBe(0);
    expect(buyer.TATA?.available).toBe(1002);
  });

  it("cancels a sell order and unlocks remaining base asset", () => {
    const engine = new Engine();

    const order = engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 10
    });

    const result = engine.cancelOrder("TATA_INR", order.orderId);

    expect(result.orderId).toBe(order.orderId);
    expect(result.remainingQty).toBe(10);
    expect(result.executedQty).toBe(0);

    const balances = engine.getBalances("2");
    expect(balances.TATA?.available).toBe(1000);
    expect(balances.TATA?.locked).toBe(0);

    const depth = engine.getDepth("TATA_INR");
    expect(depth.asks).toEqual([]);
  });

  it("cancels a partially filled sell order and unlocks only remaining quantity", () => {
    const engine = new Engine();

    const order = engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 10
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 4
    });

    const result = engine.cancelOrder("TATA_INR", order.orderId);

    expect(result.remainingQty).toBe(6);
    expect(result.executedQty).toBe(4);

    const seller = engine.getBalances("2");
    expect(seller.TATA?.available).toBe(996);
    expect(seller.TATA?.locked).toBe(0);
    expect(seller.INR?.available).toBe(1_000_400);
  });

  it("throws if buyer has insufficient quote balance", () => {
    const engine = new Engine();

    expect(() =>
      engine.placeOrder({
        market: "TATA_INR",
        userId: "1",
        side: "buy",
        price: 1_000_000,
        quantity: 10
      })
    ).toThrow("Insufficient quote balance");
  });

  it("throws if seller has insufficient base balance", () => {
    const engine = new Engine();

    expect(() =>
      engine.placeOrder({
        market: "TATA_INR",
        userId: "1",
        side: "sell",
        price: 100,
        quantity: 100_000
      })
    ).toThrow("Insufficient base balance");
  });

  it("returns open orders for a specific user", () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 5
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 110,
      quantity: 3
    });

    const user1Orders = engine.getOpenOrders("TATA_INR", "1");
    const user2Orders = engine.getOpenOrders("TATA_INR", "2");

    expect(user1Orders).toHaveLength(1);
    expect(user2Orders).toHaveLength(1);
    expect(user1Orders[0]?.side).toBe("buy");
    expect(user2Orders[0]?.side).toBe("sell");
  });

  it("throws when canceling an unknown order", () => {
    const engine = new Engine();

    expect(() => engine.cancelOrder("TATA_INR", "missing")).toThrow("Order not found");
  });

  it("records trade history after a match", () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 10
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 4
    });

    const trades = engine.getTrades("TATA_INR");

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      market: "TATA_INR",
      price: 100,
      quantity: 4,
      buyerUserId: "1",
      sellerUserId: "2"
    });
  });

  it("records multiple trades in reverse chronological order", async () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 2
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 2
    });

    await new Promise((resolve) => setTimeout(resolve, 2));

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 101,
      quantity: 3
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 101,
      quantity: 3
    });

    const trades = engine.getTrades("TATA_INR");

    expect(trades).toHaveLength(2);
    expect(trades[0]?.price).toBe(101);
    expect(trades[1]?.price).toBe(100);
  });

  it("returns empty ticker values when market has no trades", () => {
    const engine = new Engine();

    const ticker = engine.getTicker("TATA_INR");

    expect(ticker).toEqual({
      symbol: "TATA_INR",
      lastPrice: "0",
      high: "0",
      low: "0",
      volume: "0",
      quoteVolume: "0",
      firstPrice: "0",
      priceChange: "0",
      priceChangePercent: "0",
      trades: 0
    });
  });

  it("builds ticker stats from recorded trades", async () => {
    const engine = new Engine();

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 100,
      quantity: 2
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 100,
      quantity: 2
    });

    await new Promise((resolve) => setTimeout(resolve, 2));

    engine.placeOrder({
      market: "TATA_INR",
      userId: "2",
      side: "sell",
      price: 110,
      quantity: 3
    });

    engine.placeOrder({
      market: "TATA_INR",
      userId: "1",
      side: "buy",
      price: 110,
      quantity: 3
    });

    const ticker = engine.getTicker("TATA_INR");

    expect(ticker.symbol).toBe("TATA_INR");
    expect(ticker.firstPrice).toBe("100");
    expect(ticker.lastPrice).toBe("110");
    expect(ticker.high).toBe("110");
    expect(ticker.low).toBe("100");
    expect(ticker.volume).toBe("5");
    expect(ticker.quoteVolume).toBe("530");
    expect(ticker.priceChange).toBe("10");
    expect(ticker.priceChangePercent).toBe("10");
    expect(ticker.trades).toBe(2);
  });

  it("returns all tickers for all markets", () => {
    const engine = new Engine();
    engine.createMarket("INFY_INR");

    const tickers = engine.getTickers();

    expect(tickers.map((t) => t.symbol).sort()).toEqual(["INFY_INR", "TATA_INR"]);
  });


});
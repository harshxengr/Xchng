import { describe, expect, it } from "vitest";
import { Orderbook } from "../trade/Orderbook.js";

describe("Orderbook", () => {
  it("adds a buy order to the book when asks are empty", () => {
    const book = new Orderbook("TATA", "INR");

    const result = book.addOrder({
      orderId: "b1",
      userId: "u1",
      side: "buy",
      price: 100,
      quantity: 5,
      filled: 0
    });

    expect(result.executedQty).toBe(0);
    expect(result.fills).toEqual([]);
    expect(book.bids).toHaveLength(1);
    expect(book.asks).toHaveLength(0);
    expect(book.bids[0]?.orderId).toBe("b1");
  });

  it("adds a sell order to the book when bids are empty", () => {
    const book = new Orderbook("TATA", "INR");

    const result = book.addOrder({
      orderId: "s1",
      userId: "u2",
      side: "sell",
      price: 100,
      quantity: 5,
      filled: 0
    });

    expect(result.executedQty).toBe(0);
    expect(result.fills).toEqual([]);
    expect(book.asks).toHaveLength(1);
    expect(book.bids).toHaveLength(0);
    expect(book.asks[0]?.orderId).toBe("s1");
  });

  it("fully matches a buy order with an existing ask", () => {
    const book = new Orderbook("TATA", "INR");

    book.addOrder({
      orderId: "s1",
      userId: "seller",
      side: "sell",
      price: 100,
      quantity: 5,
      filled: 0
    });

    const result = book.addOrder({
      orderId: "b1",
      userId: "buyer",
      side: "buy",
      price: 100,
      quantity: 5,
      filled: 0
    });

    expect(result.executedQty).toBe(5);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]).toMatchObject({
      price: 100,
      qty: 5,
      otherUserId: "seller",
      makerOrderId: "s1"
    });

    expect(book.asks).toHaveLength(0);
    expect(book.bids).toHaveLength(0);
  });

  it("partially matches and keeps remaining sell quantity on the book", () => {
    const book = new Orderbook("TATA", "INR");

    book.addOrder({
      orderId: "s1",
      userId: "seller",
      side: "sell",
      price: 100,
      quantity: 10,
      filled: 0
    });

    const result = book.addOrder({
      orderId: "b1",
      userId: "buyer",
      side: "buy",
      price: 100,
      quantity: 4,
      filled: 0
    });

    expect(result.executedQty).toBe(4);
    expect(result.fills).toHaveLength(1);

    expect(book.asks).toHaveLength(1);
    expect(book.asks[0]?.quantity).toBe(10);
    expect(book.asks[0]?.filled).toBe(4);

    const depth = book.getDepth();
    expect(depth.asks).toEqual([["100", "6"]]);
  });

  it("does not match if prices do not cross", () => {
    const book = new Orderbook("TATA", "INR");

    book.addOrder({
      orderId: "s1",
      userId: "seller",
      side: "sell",
      price: 105,
      quantity: 5,
      filled: 0
    });

    const result = book.addOrder({
      orderId: "b1",
      userId: "buyer",
      side: "buy",
      price: 100,
      quantity: 5,
      filled: 0
    });

    expect(result.executedQty).toBe(0);
    expect(result.fills).toEqual([]);

    const depth = book.getDepth();
    expect(depth.asks).toEqual([["105", "5"]]);
    expect(depth.bids).toEqual([["100", "5"]]);
  });

  it("skips self-trading", () => {
    const book = new Orderbook("TATA", "INR");

    book.addOrder({
      orderId: "s1",
      userId: "same-user",
      side: "sell",
      price: 100,
      quantity: 5,
      filled: 0
    });

    const result = book.addOrder({
      orderId: "b1",
      userId: "same-user",
      side: "buy",
      price: 100,
      quantity: 5,
      filled: 0
    });

    expect(result.executedQty).toBe(0);
    expect(result.fills).toEqual([]);

    const depth = book.getDepth();
    expect(depth.asks).toEqual([["100", "5"]]);
    expect(depth.bids).toEqual([["100", "5"]]);
  });

  it("aggregates depth at the same price level", () => {
    const book = new Orderbook("TATA", "INR");

    book.addOrder({
      orderId: "b1",
      userId: "u1",
      side: "buy",
      price: 100,
      quantity: 2,
      filled: 0
    });

    book.addOrder({
      orderId: "b2",
      userId: "u2",
      side: "buy",
      price: 100,
      quantity: 3,
      filled: 0
    });

    book.addOrder({
      orderId: "s1",
      userId: "u3",
      side: "sell",
      price: 105,
      quantity: 4,
      filled: 0
    });

    book.addOrder({
      orderId: "s2",
      userId: "u4",
      side: "sell",
      price: 105,
      quantity: 6,
      filled: 0
    });

    const depth = book.getDepth();

    expect(depth.bids).toEqual([["100", "5"]]);
    expect(depth.asks).toEqual([["105", "10"]]);
  });

  it("cancels an existing bid", () => {
    const book = new Orderbook("TATA", "INR");

    book.addOrder({
      orderId: "b1",
      userId: "u1",
      side: "buy",
      price: 100,
      quantity: 5,
      filled: 0
    });

    const removed = book.cancel("b1");

    expect(removed).toBeDefined();
    expect(removed?.orderId).toBe("b1");
    expect(book.bids).toHaveLength(0);
  });

  it("returns undefined when canceling a missing order", () => {
    const book = new Orderbook("TATA", "INR");

    const removed = book.cancel("missing");

    expect(removed).toBeUndefined();
  });
});

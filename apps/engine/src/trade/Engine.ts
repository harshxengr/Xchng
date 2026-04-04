import crypto from "node:crypto";
import { Orderbook } from "./Orderbook.js";
import type {
    CancelOrderResult,
    Fill,
    Order,
    PlaceOrderInput,
    PlaceOrderResult,
    Side,
    UserBalance
} from "@workspace/types";

export class Engine {
    private orderbooks: Map<string, Orderbook>;
    private balances: Map<string, UserBalance>;

    constructor() {
        this.orderbooks = new Map();
        this.balances = new Map();

        this.createMarket("TATA_INR");

        this.deposit("1", "INR", 1_000_000);
        this.deposit("1", "TATA", 1_000);

        this.deposit("2", "INR", 1_000_000);
        this.deposit("2", "TATA", 1_000);

        this.deposit("5", "INR", 1_000_000);
        this.deposit("5", "TATA", 1_000);
    }

    createMarket(market: string): void {
        if (this.orderbooks.has(market)) return;
        const [baseAsset, quoteAsset] = this.splitMarket(market);
        this.orderbooks.set(market, new Orderbook(baseAsset, quoteAsset));
    }

    deposit(userId: string, asset: string, amount: number): void {
        const user = this.getOrCreateUserBalance(userId);
        const balance = this.getOrCreateAssetBalance(user, asset);
        balance.available += amount;
    }

    getBalances(userId: string): UserBalance {
        return structuredClone(this.getOrCreateUserBalance(userId));
    }

    placeOrder(input: PlaceOrderInput): PlaceOrderResult {
        const { market, userId, side, price, quantity } = input;

        if (price <= 0) throw new Error("Price must be greater than 0");
        if (quantity <= 0) throw new Error("Quantity must be greater than 0");

        const orderbook = this.mustGetOrderbook(market);
        const [baseAsset, quoteAsset] = this.splitMarket(market);

        this.checkAndLockFunds(userId, baseAsset, quoteAsset, side, price, quantity);

        const order: Order = {
            orderId: crypto.randomUUID(),
            userId,
            side,
            price,
            quantity,
            filled: 0
        };

        const { executedQty, fills } = orderbook.addOrder(order);

        this.applyFills(userId, side, baseAsset, quoteAsset, fills);

        if (side === "buy") {
            this.releaseUnusedBuyFunds(userId, quoteAsset, price, quantity, executedQty, fills);
        }

        return {
            orderId: order.orderId,
            executedQty,
            fills
        };
    }

    cancelOrder(market: string, orderId: string): CancelOrderResult {
        const orderbook = this.mustGetOrderbook(market);
        const order = orderbook.cancel(orderId);

        if (!order) {
            throw new Error("Order not found");
        }

        const [baseAsset, quoteAsset] = this.splitMarket(market);
        const user = this.getOrCreateUserBalance(order.userId);
        const remainingQty = order.quantity - order.filled;

        if (order.side === "buy") {
            const refund = remainingQty * order.price;
            const quote = this.getOrCreateAssetBalance(user, quoteAsset);
            quote.locked -= refund;
            quote.available += refund;
        } else {
            const base = this.getOrCreateAssetBalance(user, baseAsset);
            base.locked -= remainingQty;
            base.available += remainingQty;
        }

        return {
            orderId,
            remainingQty,
            executedQty: order.filled
        };
    }

    getDepth(market: string) {
        return this.mustGetOrderbook(market).getDepth();
    }

    getOpenOrders(market: string, userId: string) {
        return this.mustGetOrderbook(market).getOpenOrders(userId);
    }

    private applyFills(
        takerUserId: string,
        takerSide: Side,
        baseAsset: string,
        quoteAsset: string,
        fills: Fill[]
    ): void {
        const taker = this.getOrCreateUserBalance(takerUserId);

        for (const fill of fills) {
            const maker = this.getOrCreateUserBalance(fill.otherUserId);
            const tradedQuote = fill.qty * fill.price;

            if (takerSide === "buy") {
                this.getOrCreateAssetBalance(taker, quoteAsset).locked -= tradedQuote;
                this.getOrCreateAssetBalance(taker, baseAsset).available += fill.qty;

                this.getOrCreateAssetBalance(maker, baseAsset).locked -= fill.qty;
                this.getOrCreateAssetBalance(maker, quoteAsset).available += tradedQuote;
            } else {
                this.getOrCreateAssetBalance(taker, baseAsset).locked -= fill.qty;
                this.getOrCreateAssetBalance(taker, quoteAsset).available += tradedQuote;

                this.getOrCreateAssetBalance(maker, quoteAsset).locked -= tradedQuote;
                this.getOrCreateAssetBalance(maker, baseAsset).available += fill.qty;
            }
        }
    }

    private releaseUnusedBuyFunds(
        userId: string,
        quoteAsset: string,
        orderPrice: number,
        orderQty: number,
        executedQty: number,
        fills: Fill[]
    ): void {
        const user = this.getOrCreateUserBalance(userId);
        const quote = this.getOrCreateAssetBalance(user, quoteAsset);

        const originallyLocked = orderPrice * orderQty;
        const actuallySpent = fills.reduce((sum, fill) => sum + fill.price * fill.qty, 0);
        const stillNeededForRestingOrder = (orderQty - executedQty) * orderPrice;
        const refund = originallyLocked - actuallySpent - stillNeededForRestingOrder;

        if (refund > 0) {
            quote.locked -= refund;
            quote.available += refund;
        }
    }

    private checkAndLockFunds(
        userId: string,
        baseAsset: string,
        quoteAsset: string,
        side: Side,
        price: number,
        quantity: number
    ): void {
        const user = this.getOrCreateUserBalance(userId);

        if (side === "buy") {
            const totalCost = price * quantity;
            const quote = this.getOrCreateAssetBalance(user, quoteAsset);

            if (quote.available < totalCost) {
                throw new Error("Insufficient quote balance");
            }

            quote.available -= totalCost;
            quote.locked += totalCost;
            return;
        }

        const base = this.getOrCreateAssetBalance(user, baseAsset);

        if (base.available < quantity) {
            throw new Error("Insufficient base balance");
        }

        base.available -= quantity;
        base.locked += quantity;
    }

    private mustGetOrderbook(market: string): Orderbook {
        const orderbook = this.orderbooks.get(market);
        if (!orderbook) {
            throw new Error(`Market ${market} does not exist`);
        }
        return orderbook;
    }

    private splitMarket(market: string): [string, string] {
        const [baseAsset, quoteAsset] = market.split("_");
        if (!baseAsset || !quoteAsset) {
            throw new Error(`Invalid market: ${market}`);
        }
        return [baseAsset, quoteAsset];
    }

    private getOrCreateUserBalance(userId: string): UserBalance {
        let user = this.balances.get(userId);
        if (!user) {
            user = {};
            this.balances.set(userId, user);
        }
        return user;
    }

    private getOrCreateAssetBalance(
        user: UserBalance,
        asset: string
    ): { available: number; locked: number } {
        if (!user[asset]) {
            user[asset] = { available: 0, locked: 0 };
        }
        return user[asset];
    }
}

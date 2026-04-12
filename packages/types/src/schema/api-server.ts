import { z } from "zod";

export const placeOrderSchema = z.object({
    market: z.string().min(3),
    userId: z.string().min(1),
    side: z.enum(["buy", "sell"]),
    price: z.coerce.number().positive(),
    quantity: z.coerce.number().positive()
});

export const cancelOrderSchema = z.object({
    market: z.string().min(3),
    orderId: z.string().min(1)
});

export const balancesQuerySchema = z.object({
    userId: z.string().min(1)
});

export const openOrdersQuerySchema = z.object({
    market: z.string().min(3),
    userId: z.string().min(1)
});

export const depthQuerySchema = z.object({
    symbol: z.string().min(3)
});

export const tradesQuerySchema = z.object({
    symbol: z.string().min(3)
});

export const tickerQuerySchema = z.object({
    symbol: z.string().min(3)
});

export const depositSchema = z.object({
    userId: z.string().min(1),
    asset: z.string().min(1),
    amount: z.coerce.number().positive()
});
import { z } from "zod";

export const clientEnvSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.string(),
    NEXT_PUBLIC_API_URL: z.string(),
    NEXT_PUBLIC_WS_URL: z.string(),
});

export const serverEnvSchema = z.object({
    // Database
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),

    // Auth
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string(),

    // App
    NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.string(),
    NEXT_PUBLIC_API_URL: z.string(),
    NEXT_PUBLIC_WS_URL: z.string(),

    // Ports
    PORT: z.coerce.number().int().positive().default(4000),
    WS_PORT: z.coerce.number().int().positive().default(4001),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),

    // Market maker
    MM_MARKETS: z.string().default("TATA_INR"),
    MM_LOOP_INTERVAL_MS: z.coerce.number().default(8000),
    MM_LEVELS: z.coerce.number().default(3),
    MM_BASE_PRICE: z.coerce.number().default(100),
    MM_BASE_QUANTITY: z.coerce.number().default(2),
    MM_SPREAD_BPS: z.coerce.number().default(50),
    MM_LEVEL_SPACING_BPS: z.coerce.number().default(25),
    MM_REPRICE_TOLERANCE_BPS: z.coerce.number().default(15),
    MM_JITTER_BPS: z.coerce.number().default(8),
    MM_TARGET_BASE_RATIO: z.coerce.number().default(0.5),
    MM_MAX_INVENTORY_SKEW_BPS: z.coerce.number().default(40),

    // Operator
    OPERATOR_EMAILS: z.string().min(1),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
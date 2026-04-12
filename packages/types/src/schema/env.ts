import { z } from "zod";

export const envSchema = z.object({
    NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().optional(),
    WS_PORT: z.coerce.number().int().positive().optional(),
    DATABASE_URL: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string(),
    NEXT_PUBLIC_APP_URL: z.string(),
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    NEXT_PUBLIC_API_URL: z.string(),
    NEXT_PUBLIC_WS_URL: z.string(),
});

export type Env = z.infer<typeof envSchema>;

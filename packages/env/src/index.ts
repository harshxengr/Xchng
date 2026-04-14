import { envSchema } from "@workspace/types";

/**
 * Browser-safe environment variables.
 * In Next.js, process.env is provided by the build system.
 * On the client, only NEXT_PUBLIC_ variables are available.
 */
const isServer = typeof window === "undefined";

// Use safeParse to avoid crashing the browser if server-only variables are missing.
const parsed = isServer 
    ? envSchema.safeParse(process.env)
    : envSchema.partial().safeParse(process.env);

if (!parsed.success && isServer) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
}

export const env = (parsed.success ? parsed.data : process.env) as any;

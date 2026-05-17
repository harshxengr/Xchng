import { serverEnvSchema } from "@workspace/types";
import type { ServerEnv } from "@workspace/types";

function buildStubEnv(): ServerEnv {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://build:build@127.0.0.1:5432/build",
    REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "build-time-secret-min-32-chars-long!!",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    INTERNAL_SECRET: process.env.INTERNAL_SECRET ?? "build-time-internal-secret-32chars!",
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4001",
    OPERATOR_EMAILS: process.env.OPERATOR_EMAILS ?? "admin@example.com",
  });
}

const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.SKIP_ENV_VALIDATION === "true";

const parsed = skipValidation
  ? { success: true as const, data: buildStubEnv() }
  : serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data as ServerEnv;

import { envSchema } from "@workspace/types";
import "./index.js";

/**
 * Server-side environment utility.
 * We've removed manual .env file loading to prevent browser build errors in monorepos.
 * Ensure your process has the environment variables loaded (e.g. via turbo, docker, or shell).
 */
export const env = envSchema.parse(process.env);

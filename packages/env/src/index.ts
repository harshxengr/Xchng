import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { envSchema } from "@workspace/types";

const currentDir = dirname(fileURLToPath(import.meta.url));
const envFiles = [
  resolve(currentDir, "../../../.env.local"),
  resolve(currentDir, "../../../.env"),
].filter(existsSync);

if (envFiles.length > 0) {
  config({ path: envFiles, override: false });
}

export const env = envSchema.parse(process.env);

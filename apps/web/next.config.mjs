import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/database", "@workspace/auth", "better-auth"],
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;

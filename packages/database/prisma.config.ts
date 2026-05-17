import { defineConfig } from "prisma/config";

// Prisma generate runs at Docker build time when Render env vars are not injected yet.
// Use a placeholder URL for generate; runtime (db push) uses the real DATABASE_URL from Render.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});

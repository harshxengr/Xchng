import "dotenv/config";
import { defineConfig } from "prisma/config";
import { env } from "@workspace/env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env.DATABASE_URL,
  },
});

# Xchng

Xchng is a TypeScript exchange monorepo built with Turborepo, pnpm workspaces, Next.js, Express, WebSocket market data, a matching engine, a DB persistence worker, and a market-maker bot.

## Apps

- `apps/web`: Next.js frontend for Vercel.
- `apps/api-server`: Express API gateway and Railway production backend entrypoint.
- `apps/ws`: WebSocket market-data service.
- `apps/engine`: in-memory matching engine worker.
- `apps/db-worker`: Redis event persistence worker for PostgreSQL.
- `apps/mm-bot`: internal market-maker bot.

## Packages

- `@workspace/auth`: Better Auth setup.
- `@workspace/database`: Prisma client and schema.
- `@workspace/env`: centralized environment validation.
- `@workspace/runtime`: shared logger, Redis, and lifecycle helpers.
- `@workspace/types`: shared TypeScript domain types and schemas.
- `@workspace/ui`: shared UI primitives.

## Local Development

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev:db
pnpm dev
```

Local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- WebSocket: `ws://localhost:4001`

## Verification

```bash
pnpm lint
pnpm check-types
pnpm build
pnpm --filter engine test
```

## Deployment

- Frontend: Vercel, root directory `apps/web`.
- Backend: Railway, root Dockerfile and `railway.json`.
- Database: Neon PostgreSQL.
- Redis: Upstash Redis.

Start with the default Railway `SERVICE=api-server` monolith. Split into `SERVICE=engine`, `SERVICE=db-worker`, `SERVICE=ws`, and `SERVICE=mm-bot` when scale requires independent workers.

## Documentation

- [Local development](docs/local-development.md)
- [Production setup](docs/production.md)
- [Deployment](docs/deployment.md)
- [Scaling recommendations](docs/scaling.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Deployment checklist](docs/deployment-checklist.md)

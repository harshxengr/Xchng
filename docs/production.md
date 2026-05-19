# Production Setup

Xchng is deployed as a pnpm/Turbo monorepo with Vercel for `apps/web`, Railway for backend Node services, Neon for PostgreSQL, and Upstash for Redis.

## Architecture Decisions

- Shared runtime code lives in `@workspace/runtime` so logging, Redis retry behavior, and shutdown handling are consistent across API, websocket, engine, worker, and market-maker services.
- Shared packages compile to `dist` for production. Runtime package exports point at JavaScript output while TypeScript consumers still receive source types.
- Prisma migrations are committed under `packages/database/prisma/migrations` and production startup uses `prisma migrate deploy` instead of `db push`.
- The Railway default runs the backend as one container through `apps/api-server/src/prod-runner.ts`. This is simple and cost-effective. For scaling, deploy separate Railway services with `SERVICE=engine`, `SERVICE=db-worker`, `SERVICE=ws`, and `SERVICE=mm-bot`.
- API security is handled with Helmet, strict JSON body limits, CORS allowlists, rate limiting, session validation, and an internal bearer token for service calls.

## Required Production Variables

Set these in Railway and Vercel as appropriate:

- `DATABASE_URL`: Neon pooled PostgreSQL URL, include `sslmode=require`.
- `REDIS_URL`: Upstash Redis URL.
- `BETTER_AUTH_SECRET`: at least 32 characters.
- `BETTER_AUTH_URL`: Vercel app URL.
- `INTERNAL_SECRET`: at least 32 characters, shared only by trusted backend services.
- `NEXT_PUBLIC_APP_URL`: Vercel app URL.
- `NEXT_PUBLIC_API_URL`: Railway backend URL plus `/api/v1`.
- `NEXT_PUBLIC_WS_URL`: Railway backend websocket URL, `wss://...`.
- `CORS_ORIGINS`: comma-separated allowed browser origins.
- `OPERATOR_EMAILS`: comma-separated operator emails.

## Health Checks

- `GET /health`: lightweight process health.
- `GET /ready`: checks Redis and PostgreSQL connectivity.

Railway should use `/health` for the default backend monolith. Use `/ready` for deeper external monitoring.

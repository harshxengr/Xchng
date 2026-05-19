# Deployment

## Vercel Web

Create a Vercel project with root directory `apps/web`. The app uses `apps/web/vercel.json` to install from the monorepo root and build with Turbo.

Set these Vercel variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPERATOR_EMAILS`

The web app needs `DATABASE_URL` because the Better Auth route runs inside Next.js.

## Railway Backend

Create a Railway service from the repo root. Railway uses `railway.json` and the root `Dockerfile`.

Set these Railway variables:

- `NODE_ENV=production`
- `SERVICE=api-server`
- `PORT=8080`
- `DATABASE_URL`
- `REDIS_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `INTERNAL_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `CORS_ORIGINS`
- `OPERATOR_EMAILS`
- market-maker variables from `.env.example`

The default `SERVICE=api-server` starts the API, websocket server, engine, DB worker, and market maker in one process group. For independent scaling, duplicate the Railway service and set `SERVICE` to `engine`, `db-worker`, `ws`, or `mm-bot`. Disable HTTP health checks for worker-only services.

## CI/CD

- `.github/workflows/ci.yml` runs install, Prisma generate, lint, typecheck, and build.
- `.github/workflows/deploy.yml` contains optional Vercel and Railway deploy jobs gated by repository secrets.

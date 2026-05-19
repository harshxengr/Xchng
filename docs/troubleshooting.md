# Production Troubleshooting

## Backend starts but health check fails

Check `PORT`, Railway public networking, and container logs. The default container listens on `PORT=8080` unless Railway overrides it.

## API returns 401

Verify browser cookies are sent, `BETTER_AUTH_URL` matches the Vercel URL, and `NEXT_PUBLIC_APP_URL` is included in `CORS_ORIGINS`.

## Engine timeouts

Check Redis connectivity, the `engine:commands` queue, and `ENGINE_RPC_TIMEOUT_MS`. If engine is deployed separately, verify exactly one engine is processing the target market.

## Prisma migration fails

Run migrations against a staging Neon branch first. Production uses `pnpm --filter @workspace/database db:deploy` during backend startup.

## WebSocket connects but receives no data

Confirm the client subscribes to `depth@MARKET`, `trade@MARKET`, or `ticker@MARKET`, and check that the engine is publishing to `engine:events`.

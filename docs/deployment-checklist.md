# Deployment Checklist

- [ ] Neon database created and `DATABASE_URL` includes SSL.
- [ ] Upstash Redis created and `REDIS_URL` is set.
- [ ] Railway backend service deploys from the root Dockerfile.
- [ ] Railway `/health` returns 200.
- [ ] Railway `/ready` returns Redis and database healthy.
- [ ] Vercel web project uses `apps/web` as root directory.
- [ ] Vercel public URLs point at Railway backend.
- [ ] `BETTER_AUTH_URL` equals the production web URL.
- [ ] `CORS_ORIGINS` includes the production web URL.
- [ ] `INTERNAL_SECRET` and `BETTER_AUTH_SECRET` are strong and not committed.
- [ ] `pnpm lint`, `pnpm check-types`, and `pnpm build` pass in CI.

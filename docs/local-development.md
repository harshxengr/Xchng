# Local Development

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev:db
pnpm dev
```

Local services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- WebSocket: `ws://localhost:4001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Common Commands

```bash
pnpm lint
pnpm check-types
pnpm build
pnpm --filter engine test
pnpm db:generate
pnpm db:push
pnpm dev:stop
```

Use `pnpm db:push` only for local development. Production uses committed Prisma migrations through `pnpm db:deploy`.

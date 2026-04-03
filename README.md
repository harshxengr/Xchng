# Xchng

Xchng is a pnpm monorepo with:

- `apps/web`: Next.js frontend with Better Auth integration
- `apps/api-server`: Express API for order placement and matching
- `packages/auth`: shared Better Auth configuration
- `packages/database`: Prisma client and database helpers
- `packages/env`: shared environment loading and validation
- `packages/types`: shared Zod schemas and TypeScript types
- `packages/ui`: shared UI components and styles

## Getting Started

```bash
pnpm install
pnpm dev
```

## Common Commands

```bash
pnpm dev
pnpm check-types
pnpm --filter web lint
```

## Environment

Copy the root example file and fill in the required values:

```bash
cp .env.example .env.local
```

Environment values are loaded and validated through `@workspace/env`, which is shared across the apps and packages.

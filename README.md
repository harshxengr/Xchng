Xchng is a distributed crypto exchange monorepo built with performance and simplicity in mind.

## Architecture

- **apps/web**: Next.js frontend with Better Auth integration.
- **apps/api-server**: Express API for order placement, communicating with the engine via Redis.
- **apps/engine**: High-performance matching engine worker.
- **apps/db-worker**: Subscribes to engine events and persists state to PostgreSQL.
- **apps/ws**: Standalone WebSocket service for real-time orderbook, trade, and ticker updates.
- **packages/database**: Raw `pg` pool connection for shared DB access.
- **packages/exchange-store**: Direct SQL-based store for all trading logic.
- **packages/redis**: Shared Redis client and channel constants.

## Getting Started

### 1. Environment Setup

Copy the example environment file and fill in required values:

```bash
cp .env.example .env
```

### 2. Infrastructure Startup

Start the required services (PostgreSQL and Redis) using Docker:

```bash
pnpm infra:up
```

### 3. Database Initialization

Initialize the database schema with the provided SQL file:

```bash
pnpm db:setup
```

### 4. Run Development Server

Start all services in development mode:

```bash
pnpm dev
```

## Maintenance Commands

| Command | Action |
| --- | --- |
| `pnpm infra:up` | Starts Postgres & Redis containers in background |
| `pnpm infra:down` | Stops and removes infrastructure containers |
| `pnpm db:setup` | Re-initializes database schema (caution: does not drop existing data if using IF NOT EXISTS, but meant for setup) |
| `pnpm build` | Builds all packages and apps |
| `pnpm check-types` | Runs type checks across the entire monorepo |

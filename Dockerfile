FROM node:20-alpine AS builder

RUN corepack enable
RUN apk add --no-cache libc6-compat python3 make g++ openssl

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

# Render env vars are injected at runtime, not during Docker build
ENV SKIP_ENV_VALIDATION=1

# Prisma client + backend monolith only (skip Next.js web build to save RAM/time)
RUN pnpm --filter @workspace/database db:generate
RUN pnpm turbo build --filter=api-server... --concurrency=1

FROM node:20-alpine AS runner

RUN corepack enable
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app .

RUN chmod +x scripts/render-start.sh

# Render sets PORT; health check hits GET /health on the shared HTTP server
EXPOSE 10000

CMD ["./scripts/render-start.sh"]

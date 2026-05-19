FROM node:20-alpine AS builder

RUN corepack enable
RUN apk add --no-cache libc6-compat python3 make g++ openssl

WORKDIR /app
ENV CI=true

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
ENV SKIP_ENV_VALIDATION=1
RUN pnpm --filter @workspace/database db:generate
RUN pnpm turbo run build --filter=api-server... --filter=@workspace/ws... --filter=engine... --filter=db-worker... --filter=mm-bot... --concurrency=1
RUN pnpm prune --prod

FROM node:20-alpine AS runner

RUN corepack enable && apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV SERVICE=api-server

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/scripts ./scripts

RUN chmod +x scripts/railway-start.sh

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["./scripts/railway-start.sh"]

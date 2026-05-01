FROM node:20-alpine AS builder
# Install pnpm
RUN corepack enable

# Add required dependencies for native modules (like bcrypt, Prisma, etc.)
RUN apk add --no-cache libc6-compat python3 make g++ openssl

WORKDIR /app

# Copy package management files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy all workspaces
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client and Build all packages
# Using the workspace scripts to build everything
RUN pnpm run build

# --- RUNNER STAGE ---
FROM node:20-alpine AS runner
RUN corepack enable
RUN apk add --no-cache openssl

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app .

# Expose ports for Web (3000), API Server (4000), WS (4001)
EXPOSE 3000 4000 4001

# The default command runs all services concurrently via turbo.
# To run a specific service, override the CMD in your docker-compose.yml 
# Example: CMD ["pnpm", "--filter", "engine", "run", "start"]
CMD ["pnpm", "start"]

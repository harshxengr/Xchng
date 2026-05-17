#!/bin/sh
set -eu

echo "Applying database schema..."
pnpm --filter @workspace/database db:push

echo "Starting production monolith..."
exec node apps/api-server/dist/prod-runner.js

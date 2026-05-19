#!/bin/sh
set -eu

SERVICE="${SERVICE:-api-server}"

if [ "$SERVICE" = "api-server" ]; then
  echo "Applying database migrations..."
  pnpm --filter @workspace/database db:deploy
  echo "Starting API backend monolith..."
  exec node apps/api-server/dist/prod-runner.js
fi

case "$SERVICE" in
  ws)
    exec node apps/ws/dist/index.js
    ;;
  engine)
    exec node apps/engine/dist/worker.js
    ;;
  db-worker)
    exec node apps/db-worker/dist/index.js
    ;;
  mm-bot)
    exec node apps/mm-bot/dist/index.js
    ;;
  *)
    echo "Unknown SERVICE: $SERVICE" >&2
    exit 1
    ;;
esac

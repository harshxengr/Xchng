import { createServer } from "node:http";
import { attachWebSocketServer } from "@workspace/ws";
import { startEngine, stopEngine } from "engine/worker";
import { startDbWorker, stopDbWorker } from "db-worker";
import { startMmBot, stopMmBot } from "mm-bot";
import { logger, registerShutdown } from "@workspace/runtime";
import { app, closeApiResources } from "./app.js";
import { isMainModule } from "./is-main.js";
import { applyRailwayPublicUrls } from "./railway-env.js";

async function startProductionMonolith() {
  applyRailwayPublicUrls();

  const serverEnv = await import("@workspace/env/server");
  const env = serverEnv.env ?? serverEnv.default?.env;
  const port = Number(process.env.PORT || env.PORT || 8080);
  const server = createServer(app);

  const webSocketServer = await attachWebSocketServer(server, env.REDIS_URL);

  void startEngine().catch((error) => {
    logger.error("Engine failed", { error });
    process.exit(1);
  });

  void startDbWorker().catch((error) => {
    logger.error("DB worker failed", { error });
    process.exit(1);
  });

  startMmBot();

  server.listen(port, () => {
    logger.info("Production backend listening", { port });
  });

  registerShutdown("backend-monolith", async () => {
    webSocketServer.close();
    await Promise.allSettled([
      stopMmBot(),
      stopDbWorker(),
      stopEngine(),
      closeApiResources(),
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
    ]);
  });
}

if (isMainModule(import.meta.url)) {
  startProductionMonolith().catch((error) => {
    logger.error("Failed to start production backend", { error });
    process.exit(1);
  });
}

export { startProductionMonolith };

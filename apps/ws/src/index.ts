import * as serverEnv from "@workspace/env/server";
import { logger, registerShutdown } from "@workspace/runtime";
import { isMainModule } from "./is-main.js";
import { closeWebSocketResources, startStandaloneWebSocketServer } from "./ws-server.js";

const env = serverEnv.env ?? serverEnv.default?.env;

if (isMainModule(import.meta.url)) {
  const port = Number(process.env.WS_PORT || env.WS_PORT || 4001);

  startStandaloneWebSocketServer(port, env.REDIS_URL)
    .then((server) => {
      registerShutdown("ws", async () => {
        server.close();
        await closeWebSocketResources();
      });
    })
    .catch((error) => {
      logger.error("WS failure", { error });
      process.exit(1);
    });
}

export { attachWebSocketServer, closeWebSocketResources, startStandaloneWebSocketServer } from "./ws-server.js";

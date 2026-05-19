import * as serverEnv from "@workspace/env/server";
import { logger, registerShutdown } from "@workspace/runtime";
import { app, closeApiResources } from "./app.js";
import { isMainModule } from "./is-main.js";

const env = serverEnv.env ?? serverEnv.default?.env;

if (isMainModule(import.meta.url)) {
  const port = env.PORT || 4000;
  const server = app.listen(port, () => {
    logger.info("API server listening", { port });
  });

  registerShutdown("api-server", async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await closeApiResources();
  });
}

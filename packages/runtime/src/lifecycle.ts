import { logger } from "./logger.js";

type ShutdownHandler = () => Promise<void> | void;

export function registerShutdown(service: string, handler: ShutdownHandler) {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("Shutdown signal received", { service, signal });

    const timeout = setTimeout(() => {
      logger.error("Forced shutdown after timeout", { service, signal });
      process.exit(1);
    }, 15_000);
    timeout.unref();

    try {
      await handler();
      clearTimeout(timeout);
      process.exit(0);
    } catch (error) {
      logger.error("Graceful shutdown failed", { service, signal, error });
      clearTimeout(timeout);
      process.exit(1);
    }
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

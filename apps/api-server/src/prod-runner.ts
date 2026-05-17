import { createServer } from "node:http";
import { attachWebSocketServer } from "@workspace/ws";
import { startEngine } from "engine/worker";
import { startDbWorker } from "db-worker";
import { startMmBot } from "mm-bot";
import { app } from "./app.js";
import { isMainModule } from "./is-main.js";
import { applyRenderPublicUrls } from "./render-env.js";

async function startProductionMonolith() {
    applyRenderPublicUrls();

    const serverEnv = await import("@workspace/env/server");
    const env = serverEnv.env ?? serverEnv.default?.env;
    const port = Number(process.env.PORT || env.PORT || 10000);
    const server = createServer(app);

    await attachWebSocketServer(server, env.REDIS_URL);

    void startEngine().catch((error) => {
        console.error("Engine failed:", error);
        process.exit(1);
    });

    void startDbWorker().catch((error) => {
        console.error("DB worker failed:", error);
        process.exit(1);
    });

    startMmBot();

    server.listen(port, () => {
        console.log(`🚀 Production Monolith running on port ${port}`);
    });
}

if (isMainModule(import.meta.url)) {
    startProductionMonolith().catch((error) => {
        console.error("Failed to start production monolith:", error);
        process.exit(1);
    });
}

export { startProductionMonolith };

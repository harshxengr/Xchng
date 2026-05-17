export { attachWebSocketServer, startStandaloneWebSocketServer } from "./ws-server.js";

import * as serverEnv from "@workspace/env/server";
import { startStandaloneWebSocketServer } from "./ws-server.js";
import { isMainModule } from "./is-main.js";

const env = serverEnv.env ?? serverEnv.default?.env;

async function main() {
    const port = Number(process.env.WS_PORT || 4001);
    const redisUrl = env.REDIS_URL || "redis://localhost:6379";
    await startStandaloneWebSocketServer(port, redisUrl);
}

if (isMainModule(import.meta.url)) {
    main().catch((e) => {
        console.error("WS failure:", e);
        process.exit(1);
    });
}

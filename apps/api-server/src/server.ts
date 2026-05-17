import * as serverEnv from "@workspace/env/server";
import { app } from "./app.js";
import { isMainModule } from "./is-main.js";

const env = serverEnv.env ?? serverEnv.default?.env;

if (isMainModule(import.meta.url)) {
    const port = env.PORT || 4000;
    app.listen(port, () => {
        console.log(`API Server running on port ${port}`);
    });
}

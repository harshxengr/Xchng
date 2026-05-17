/**
 * Render injects RENDER_EXTERNAL_URL (e.g. https://xchng-backend.onrender.com).
 * Derive public API/WS URLs so mm-bot and clients work without manual env wiring.
 */
export function applyRenderPublicUrls(): void {
    const external = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");
    if (!external) {
        return;
    }

    if (!process.env.NEXT_PUBLIC_API_URL) {
        process.env.NEXT_PUBLIC_API_URL = `${external}/api/v1`;
    }

    if (!process.env.NEXT_PUBLIC_WS_URL) {
        const wsBase = external
            .replace(/^https:\/\//i, "wss://")
            .replace(/^http:\/\//i, "ws://");
        process.env.NEXT_PUBLIC_WS_URL = wsBase;
    }
}

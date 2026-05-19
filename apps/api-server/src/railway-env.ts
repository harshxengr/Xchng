export function applyRailwayPublicUrls() {
  const external = (process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!external) {
    return;
  }

  if (!process.env.NEXT_PUBLIC_API_URL) {
    process.env.NEXT_PUBLIC_API_URL = `https://${external}/api/v1`;
  }

  if (!process.env.NEXT_PUBLIC_WS_URL) {
    process.env.NEXT_PUBLIC_WS_URL = `wss://${external}`;
  }
}

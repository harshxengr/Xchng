export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toError(error: unknown, fallback = "Unknown error") {
  return error instanceof Error ? error : new Error(fallback);
}

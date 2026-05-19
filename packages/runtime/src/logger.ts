type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
const minimumLevel = levelPriority[configuredLevel] ?? levelPriority.info;
const serviceName = process.env.SERVICE_NAME ?? process.env.RAILWAY_SERVICE_NAME ?? "xchng";

function normalizeError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  if (levelPriority[level] < minimumLevel) {
    return;
  }

  const payload = {
    level,
    service: serviceName,
    message,
    time: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(payload, (_key, value) => normalizeError(value));
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};

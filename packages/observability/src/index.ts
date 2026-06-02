export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  console[level === "debug" ? "log" : level](
    JSON.stringify({
      level,
      message,
      service: "leadsy",
      timestamp: new Date().toISOString(),
      ...fields
    })
  );
}

export async function withSpan<T>(name: string, fn: () => Promise<T>, fields: Record<string, unknown> = {}) {
  const startedAt = performance.now();
  try {
    const result = await fn();
    log("info", `${name}.complete`, { durationMs: Math.round(performance.now() - startedAt), ...fields });
    return result;
  } catch (error) {
    log("error", `${name}.failed`, {
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : "unknown",
      ...fields
    });
    throw error;
  }
}

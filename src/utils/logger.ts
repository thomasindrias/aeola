const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;
type WriteFn = (line: string) => void;

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

export function createLogger(
  minLevel?: Level,
  write: WriteFn = (line) => console.log(line),
): Logger {
  const threshold = LEVELS[minLevel ?? "info"];
  const emit = (level: Level, msg: string, ctx?: Record<string, unknown>) => {
    if (LEVELS[level] < threshold) return;
    write(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx }));
  };
  return {
    debug: (msg, ctx) => emit("debug", msg, ctx),
    info: (msg, ctx) => emit("info", msg, ctx),
    warn: (msg, ctx) => emit("warn", msg, ctx),
    error: (msg, ctx) => emit("error", msg, ctx),
  };
}

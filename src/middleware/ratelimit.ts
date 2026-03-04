export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createRateLimiter(opts: {
  maxRequests: number;
  windowMs: number;
}): RateLimiter {
  const { maxRequests, windowMs } = opts;
  const windows = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const timestamps = windows.get(key) ?? [];
      const valid = timestamps.filter((t) => now - t < windowMs);

      if (valid.length >= maxRequests) {
        const oldest = valid[0];
        return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
      }

      valid.push(now);
      windows.set(key, valid);
      return { allowed: true };
    },
  };
}

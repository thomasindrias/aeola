import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { createRateLimiter } from "./ratelimit.ts";

describe("RateLimiter", () => {
  it("should allow requests under limit", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    assertEquals(limiter.check("key1").allowed, true);
    assertEquals(limiter.check("key1").allowed, true);
    assertEquals(limiter.check("key1").allowed, true);
  });

  it("should block requests over limit", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    limiter.check("key1");
    limiter.check("key1");
    const result = limiter.check("key1");
    assertEquals(result.allowed, false);
    assertEquals(typeof result.retryAfterMs, "number");
  });

  it("should track keys independently", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    assertEquals(limiter.check("key1").allowed, true);
    assertEquals(limiter.check("key2").allowed, true);
    assertEquals(limiter.check("key1").allowed, false);
  });
});

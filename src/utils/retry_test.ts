import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertRejects } from "@std/assert";
import { retry } from "./retry.ts";

describe("retry", () => {
  it("should succeed on first attempt", async () => {
    let calls = 0;
    const result = await retry(() => {
      calls++;
      return Promise.resolve("ok");
    });
    assertEquals(result, "ok");
    assertEquals(calls, 1);
  });

  it("should succeed after transient failures", async () => {
    let calls = 0;
    const result = await retry(() => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return Promise.resolve("recovered");
    }, { maxAttempts: 3, baseDelayMs: 1 });
    assertEquals(result, "recovered");
    assertEquals(calls, 3);
  });

  it("should throw after max attempts exhausted", async () => {
    await assertRejects(
      () => retry(() => Promise.reject(new Error("permanent")), { maxAttempts: 2, baseDelayMs: 1 }),
      Error,
      "permanent",
    );
  });

  it("should not retry when shouldRetry returns false", async () => {
    let calls = 0;
    await assertRejects(
      () =>
        retry(() => {
          calls++;
          return Promise.reject(new Error("fatal"));
        }, { maxAttempts: 3, baseDelayMs: 1, shouldRetry: () => false }),
      Error,
      "fatal",
    );
    assertEquals(calls, 1);
  });
});

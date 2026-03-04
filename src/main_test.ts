import { describe, it, afterEach } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { createHttpHandler } from "./main.ts";
import { createDatabase } from "./storage/db.ts";

describe("HTTP Server", () => {
  let db: ReturnType<typeof createDatabase>;

  afterEach(() => {
    db?.close();
  });

  it("should reject requests without API key with 401", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(new Request("http://localhost/mcp", { method: "POST" }));
    assertEquals(response.status, 401);
  });

  it("should reject requests with wrong API key with 401", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "Authorization": "Bearer wrong-key" },
      }),
    );
    assertEquals(response.status, 401);
  });

  it("should return 200 for health check without auth", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/health"),
    );
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.status, "ok");
  });

  it("should return 400 for malformed JSON on /mcp", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: "not json",
      }),
    );
    assertEquals(response.status, 400);
  });

  it("should return 404 for unknown paths", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/unknown", {
        headers: { "Authorization": "Bearer test-api-key" },
      }),
    );
    assertEquals(response.status, 404);
  });
});

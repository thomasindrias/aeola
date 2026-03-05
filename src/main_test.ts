import { afterEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
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
    const response = await handler(
      new Request("http://localhost/mcp", { method: "POST" }),
    );
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

  it("should reject POST /ingest without auth", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", name: "Test" }),
      }),
    );
    assertEquals(response.status, 401);
  });

  it("should reject POST /ingest with invalid JSON", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/ingest", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: "not-json",
      }),
    );
    assertEquals(response.status, 400);
  });

  it("should reject POST /ingest with missing url or name", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/ingest", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.error, "url and name are required");
  });

  it("should reject POST /ingest with non-http URL", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/ingest", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "file:///etc/passwd", name: "Evil" }),
      }),
    );
    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.error, "Only http/https URLs are supported");
  });

  it("should successfully call POST /ingest with injected ingestFn", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key", {
      ingestFn: () =>
        Promise.resolve({
          jobId: 1,
          merchantId: 1,
          productsIngested: 3,
          urlsDiscovered: 10,
          errors: [],
        }),
    });
    const response = await handler(
      new Request("http://localhost/ingest", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://shop.example.com",
          name: "Test Shop",
        }),
      }),
    );
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.merchantId, 1);
    assertEquals(body.productsIngested, 3);
    assertEquals(body.urlsDiscovered, 10);
  });

  it("should return 429 when rate limited on /ingest", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key", {
      ingestFn: () =>
        Promise.resolve({
          jobId: 1,
          merchantId: 1,
          productsIngested: 0,
          urlsDiscovered: 0,
          errors: [],
        }),
      rateLimitMax: 1,
    });
    const makeReq = () =>
      new Request("http://localhost/ingest", {
        method: "POST",
        headers: {
          "Authorization": "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com", name: "Test" }),
      });
    await handler(makeReq()); // first — allowed
    const response = await handler(makeReq()); // second — blocked
    assertEquals(response.status, 429);
  });

  it("should serve OpenAPI spec at /openapi.json", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/openapi.json"),
    );
    assertEquals(response.status, 200);
    const spec = await response.json();
    assertEquals(spec.openapi, "3.1.0");
    assertEquals(spec.info.title, "Aeola API");
  });

  it("should include Aeola branding in OpenAPI spec", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/openapi.json"),
    );
    const spec = await response.json();
    assert(spec.info.description.includes("Aeola"));
    assert(spec.info.description.includes("Agent Engine Optimization"));
  });

  it("should include ingestion job and category schemas in OpenAPI spec", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/openapi.json"),
    );
    const spec = await response.json();
    assert(spec.components.schemas.IngestionJob);
    assert(spec.components.schemas.Category);
    assert(spec.paths["/api/jobs/{id}"]);
    assert(spec.paths["/api/categories"]);
  });

  it("should return 204 for OPTIONS preflight with CORS headers", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/api/merchants", { method: "OPTIONS" }),
    );
    assertEquals(response.status, 204);
    assertEquals(
      response.headers.get("Access-Control-Allow-Methods"),
      "GET, POST, OPTIONS",
    );
  });

  it("should include CORS headers on responses", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(new Request("http://localhost/health"));
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
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

  it("should serve landing page at GET / when landingHtml provided", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key", {
      landingHtml: "<html><body>Aeola</body></html>",
    });
    const response = await handler(new Request("http://localhost/"));
    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get("Content-Type"),
      "text/html; charset=utf-8",
    );
    const body = await response.text();
    assertEquals(body.includes("Aeola"), true);
  });

  it("should not require auth for GET /", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key", {
      landingHtml: "<html>Landing</html>",
    });
    const response = await handler(new Request("http://localhost/"));
    assertEquals(response.status, 200);
  });

  it("should return 404 for GET / when no landingHtml provided", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key");
    const response = await handler(
      new Request("http://localhost/", {
        headers: { "Authorization": "Bearer test-api-key" },
      }),
    );
    assertEquals(response.status, 404);
  });

  it("should include CORS headers on landing page", async () => {
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key", {
      landingHtml: "<html>Landing</html>",
    });
    const response = await handler(new Request("http://localhost/"));
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  });

  it("should include pipeline section in landing page", async () => {
    const landingHtml = Deno.readTextFileSync(
      new URL("./static/landing.html", import.meta.url).pathname,
    );
    db = createDatabase(":memory:");
    const handler = createHttpHandler(db, "test-api-key", {
      landingHtml,
    });
    const response = await handler(new Request("http://localhost/"));
    const body = await response.text();
    assertEquals(body.includes('id="pipeline"'), true);
    assertEquals(body.includes("How It Works"), true);
    assertEquals(body.includes("Discovery"), true);
    assertEquals(body.includes("Delivery"), true);
    assertEquals(body.includes("pipeline-node"), true);
    assertEquals(body.includes("pipeline-connector"), true);
    assertEquals(body.includes("prefers-reduced-motion"), true);
  });
});

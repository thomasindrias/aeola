import { createDatabase } from "./storage/db.ts";
import { createMcpServer } from "./mcp/server.ts";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Database } from "@db/sqlite";
import { timingSafeEqual } from "@std/crypto/timing-safe-equal";
import { buildIngestOptions } from "./pipeline/wire.ts";
import { ingestMerchant, type IngestResult } from "./pipeline/ingest.ts";
import { createLogger, type Logger } from "./utils/logger.ts";
import { createRateLimiter } from "./middleware/ratelimit.ts";
import { addCorsHeaders, handlePreflight } from "./middleware/cors.ts";
import { createApiHandler } from "./api/routes.ts";
import { getOpenApiSpec } from "./api/openapi.ts";

function constantTimeAuthCheck(
  authHeader: string | null,
  apiKey: string,
): boolean {
  const expected = new TextEncoder().encode(`Bearer ${apiKey}`);
  const actual = new TextEncoder().encode(authHeader ?? "");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function validateHttpUrl(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Only http/https URLs are supported";
    }
    return null;
  } catch {
    return "Invalid URL";
  }
}

export type IngestFn = (
  db: Database,
  url: string,
  name: string,
) => Promise<IngestResult>;

function defaultIngest(
  db: Database,
  url: string,
  name: string,
): Promise<IngestResult> {
  const options = buildIngestOptions(url, name);
  return ingestMerchant(db, options);
}

export function createHttpHandler(
  db: Database,
  apiKey: string,
  options?: {
    ingestFn?: IngestFn;
    logger?: Logger;
    rateLimitMax?: number;
    corsOrigin?: string;
    landingHtml?: string;
  },
) {
  const ingestFn = options?.ingestFn ?? defaultIngest;
  const log = options?.logger ?? createLogger();
  const rateLimiter = createRateLimiter({
    maxRequests: options?.rateLimitMax ?? 5,
    windowMs: 60_000,
  });
  const corsOrigin = options?.corsOrigin ?? "*";
  const landingHtml = options?.landingHtml;
  const apiHandler = createApiHandler(db);
  return async (request: Request): Promise<Response> => {
    const start = Date.now();
    const url = new URL(request.url);

    const respond = (response: Response) => {
      log.info("request", {
        method: request.method,
        path: url.pathname,
        status: response.status,
        duration_ms: Date.now() - start,
      });
      return addCorsHeaders(response, corsOrigin);
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return handlePreflight(corsOrigin);
    }

    // Unauthenticated endpoints
    if (url.pathname === "/" && request.method === "GET" && landingHtml) {
      return respond(
        new Response(landingHtml, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
      );
    }

    if (url.pathname === "/openapi.json") {
      return respond(
        new Response(JSON.stringify(getOpenApiSpec()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (url.pathname === "/health") {
      return respond(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // Auth check for all other endpoints
    const authHeader = request.headers.get("Authorization");
    if (!constantTimeAuthCheck(authHeader, apiKey)) {
      return respond(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // REST API routes
    const apiResponse = apiHandler(request);
    if (apiResponse) return respond(apiResponse);

    if (url.pathname === "/ingest" && request.method === "POST") {
      const rateKey = authHeader ?? "anonymous";
      const rateResult = rateLimiter.check(rateKey);
      if (!rateResult.allowed) {
        const retryAfter = Math.ceil(
          (rateResult.retryAfterMs ?? 60_000) / 1000,
        );
        return respond(
          new Response(JSON.stringify({ error: "Too Many Requests" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
            },
          }),
        );
      }
      let body: { url?: string; name?: string };
      try {
        body = await request.json();
      } catch {
        return respond(
          new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (!body.url || !body.name) {
        return respond(
          new Response(JSON.stringify({ error: "url and name are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      const urlError = validateHttpUrl(body.url);
      if (urlError) {
        return respond(
          new Response(JSON.stringify({ error: urlError }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      const result = await ingestFn(db, body.url, body.name);
      return respond(
        new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (url.pathname === "/mcp") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return respond(
          new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      // Create a fresh server + transport per request (stateless mode)
      const server = createMcpServer(db);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      return await transport.handleRequest(request, { parsedBody: body });
    }

    return respond(
      new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
}

// Main entry point — wires real dependencies
if (import.meta.main) {
  const logLevel = Deno.env.get("LOG_LEVEL") as
    | "debug"
    | "info"
    | "warn"
    | "error"
    | undefined;
  const log = createLogger(logLevel);

  const apiKey = Deno.env.get("API_KEY");
  if (!apiKey) {
    log.error("API_KEY environment variable is required");
    Deno.exit(1);
  }

  const dbPath = Deno.env.get("DB_PATH") ?? "./aeola.db";
  const db = createDatabase(dbPath);
  const rateLimitMax = parseInt(Deno.env.get("RATE_LIMIT") ?? "5");
  const corsOrigin = Deno.env.get("CORS_ORIGINS") ?? "*";
  const stripeLink = Deno.env.get("STRIPE_PAYMENT_LINK") ?? "#";
  const landingPath = `${import.meta.dirname}/static/landing.html`;
  let landingHtml: string | undefined;
  try {
    landingHtml = Deno.readTextFileSync(landingPath)
      .replaceAll("{{STRIPE_PAYMENT_LINK}}", stripeLink);
  } catch {
    log.warn("landing page not found", { path: landingPath });
  }
  const handler = createHttpHandler(db, apiKey, {
    logger: log,
    rateLimitMax,
    corsOrigin,
    landingHtml,
  });
  const port = parseInt(Deno.env.get("PORT") ?? "8000");

  log.info("server started", { port, dbPath });
  Deno.serve({ port }, handler);
}

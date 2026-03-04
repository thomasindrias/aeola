import { createDatabase } from "./storage/db.ts";
import { createMcpServer } from "./mcp/server.ts";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Database } from "@db/sqlite";
import { timingSafeEqual } from "@std/crypto/timing-safe-equal";
import { buildIngestOptions } from "./pipeline/wire.ts";
import { ingestMerchant, type IngestResult } from "./pipeline/ingest.ts";

function constantTimeAuthCheck(authHeader: string | null, apiKey: string): boolean {
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

export type IngestFn = (db: Database, url: string, name: string) => Promise<IngestResult>;

function defaultIngest(db: Database, url: string, name: string): Promise<IngestResult> {
  const options = buildIngestOptions(url, name);
  return ingestMerchant(db, options);
}

export function createHttpHandler(
  db: Database,
  apiKey: string,
  options?: { ingestFn?: IngestFn },
) {
  const ingestFn = options?.ingestFn ?? defaultIngest;
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    // Health check is unauthenticated (for load balancers / k8s probes)
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Auth check for all other endpoints
    const authHeader = request.headers.get("Authorization");
    if (!constantTimeAuthCheck(authHeader, apiKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/ingest" && request.method === "POST") {
      let body: { url?: string; name?: string };
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (!body.url || !body.name) {
        return new Response(JSON.stringify({ error: "url and name are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const urlError = validateHttpUrl(body.url);
      if (urlError) {
        return new Response(JSON.stringify({ error: urlError }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const result = await ingestFn(db, body.url, body.name);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/mcp") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Create a fresh server + transport per request (stateless mode)
      const server = createMcpServer(db);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      return await transport.handleRequest(request, { parsedBody: body });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };
}

// Main entry point — wires real dependencies
if (import.meta.main) {
  const apiKey = Deno.env.get("API_KEY");
  if (!apiKey) {
    console.error("API_KEY environment variable is required");
    Deno.exit(1);
  }

  const dbPath = Deno.env.get("DB_PATH") ?? "./agent-store.db";
  const db = createDatabase(dbPath);
  const handler = createHttpHandler(db, apiKey);
  const port = parseInt(Deno.env.get("PORT") ?? "8000");

  console.log(`Agent Store running on http://localhost:${port}`);
  Deno.serve({ port }, handler);
}

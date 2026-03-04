import { createDatabase } from "./storage/db.ts";
import { createMcpServer } from "./mcp/server.ts";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Database } from "@db/sqlite";

export function createHttpHandler(db: Database, apiKey: string) {
  const server = createMcpServer(db);

  return async (request: Request): Promise<Response> => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/mcp") {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      const body = await request.json();
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

  const dbPath = Deno.env.get("DB_PATH") ?? "./agentstore.db";
  const db = createDatabase(dbPath);
  const handler = createHttpHandler(db, apiKey);
  const port = parseInt(Deno.env.get("PORT") ?? "8000");

  console.log(`AgentStore MCP Bridge running on http://localhost:${port}`);
  Deno.serve({ port }, handler);
}

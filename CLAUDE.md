# AgentStore MCP Bridge

## Overview

Zero-touch translation layer that crawls e-commerce websites, uses OpenAI to dynamically extract product data into structured JSON, stores it in SQLite, and serves it via an MCP-compliant HTTP server.

## Architecture

Five-component AI-first pipeline:
1. **Discovery** (Crawlee) — URL queuing, retries, dedup, `enqueueLinks()` with glob patterns
2. **Extraction** (Agent Browser CLI) — Compact accessibility tree snapshots (~200-400 tokens per page)
3. **Brain** (OpenAI) — Dynamic schema inference from snapshots, no hardcoded schemas
4. **Storage** (SQLite) — Dynamic JSON storage with `@db/sqlite`
5. **Delivery** (MCP Server) — Streamable HTTP transport with Zod schemas

## Tech Stack

- **Runtime:** Deno 2.x, TypeScript
- **Crawling:** Crawlee (`npm:crawlee`) — `PlaywrightCrawler`, `enqueueLinks()`, glob patterns
- **Extraction:** Agent Browser (CLI — `agent-browser`) — `open`, `snapshot -i -c`
- **AI:** OpenAI (`jsr:@openai/openai`) — `gpt-4o-mini`, dynamic schema extraction
- **Database:** SQLite (`jsr:@db/sqlite`) — WAL mode, JSON storage
- **MCP:** SDK v2 (`npm:@modelcontextprotocol/sdk`) — `McpServer`, `registerTool()`, Zod schemas
- **Transport:** `WebStandardStreamableHTTPServerTransport` (SSE is deprecated)
- **Container:** Docker with Playwright base image

## Key Decisions

- `"nodeModulesDir": "auto"` required in deno.json for Crawlee compatibility
- Agent Browser is a CLI tool — shell out via `Deno.Command`
- MCP SDK v2 uses `server.registerTool()` with `z.object()` Zod schemas
- All database query logic in `src/storage/db.ts` — single source of truth
- Dependency injection at boundaries for testability
- `@db/sqlite` auto-parses JSON from SQLite JSON functions

## Project Structure

```
src/
├── main.ts              # HTTP server entry point
├── main_test.ts
├── brain/extractor.ts   # OpenAI dynamic schema extraction
├── extractor/snapshot.ts # Agent Browser CLI wrapper
├── mcp/server.ts        # MCP server with Zod tools
├── pipeline/ingest.ts   # Orchestration pipeline
├── spider/discovery.ts  # Crawlee URL discovery
└── storage/db.ts        # SQLite database layer
```

## Running

```bash
# Development
API_KEY=xxx OPENAI_API_KEY=xxx deno run --allow-all src/main.ts

# Tests
deno test --allow-all

# Docker
docker compose up --build
```

# Agent Store

## Purpose

Agent Store is an **Agent Engine Optimization (AEO)** infrastructure layer — it makes e-commerce product data discoverable and consumable by AI agents, not just human browsers.

Where SEO optimized websites for search engine crawlers, AEO optimizes data for **agentic systems** — LLMs, shopping agents, and autonomous commerce protocols that need structured, machine-readable product information to recommend, compare, and transact on behalf of users. In the emerging agent economy, if your products aren't in a format agents can consume, you're invisible.

Agent Store bridges this gap: it crawls traditional e-commerce sites, dynamically extracts product data using LLMs (no hardcoded schemas), and serves it via MCP — the open protocol that AI agents use to discover and consume external data and tools.

### Where This Fits

- **AEO (Agent Engine Optimization)** — Making merchant data agent-readable so AI assistants (ChatGPT, Claude, Perplexity, etc.) can find, trust, and recommend products. The shift from "rank on page 1" to "be the answer the agent selects."
- **ACP (Agent Commerce Protocol)** — Protocols like Virtuals Protocol's ACP enable autonomous agent-to-agent commerce with on-chain escrow and verification. Agent Store provides the structured product catalog that these agent marketplaces need to function — agents can't buy what they can't discover.
- **MCP (Model Context Protocol)** — The open standard for how LLM applications connect to external data. Agent Store exposes product data as MCP tools, making any merchant's catalog instantly accessible to any MCP-compatible AI agent.

## Architecture

Five-component AI-first pipeline:
1. **Discovery** (Playwright) — Direct browser crawling with smart URL prioritization and dedup
2. **Extraction** (Agent Browser CLI) — Compact accessibility tree snapshots (~200-400 tokens per page)
3. **Brain** (OpenAI) — Dynamic schema inference from snapshots, no hardcoded schemas
4. **Storage** (SQLite) — Dynamic JSON storage with `@db/sqlite`
5. **Delivery** (MCP Server + REST API) — Streamable HTTP transport with Zod schemas, plus `/ingest` endpoint

## Tech Stack

- **Runtime:** Deno 2.x, TypeScript
- **Crawling:** Playwright (`npm:playwright`) — `chromium.launch()`, direct page navigation, link extraction
- **Extraction:** Agent Browser (CLI — `agent-browser`) — `open`, `snapshot -i -c`
- **AI:** OpenAI (`jsr:@openai/openai`) — `gpt-4o-mini`, dynamic schema extraction
- **Database:** SQLite (`jsr:@db/sqlite`) — WAL mode, JSON storage
- **MCP:** SDK v2 (`npm:@modelcontextprotocol/sdk`) — `McpServer`, `registerTool()`, Zod schemas
- **Transport:** `WebStandardStreamableHTTPServerTransport` (SSE is deprecated)
- **Container:** Docker with Playwright base image

## Key Decisions

- `"nodeModulesDir": "auto"` required in deno.json for Playwright/npm compatibility
- Agent Browser is a CLI tool — shell out via `Deno.Command`
- MCP SDK v2 uses `server.registerTool()` with `z.object()` Zod schemas
- All database query logic in `src/storage/db.ts` — single source of truth
- Dependency injection at boundaries for testability (`ingestFn` in server/handler)
- `@db/sqlite` auto-parses JSON from SQLite JSON functions
- URL scheme validation (http/https only) on all ingestion paths to prevent SSRF
- Playwright version must stay in sync between `deno.json` and `Dockerfile`

## Project Structure

```
src/
├── main.ts              # HTTP server entry point (/health, /ingest, /mcp)
├── main_test.ts
├── brain/extractor.ts   # OpenAI dynamic schema extraction
├── extractor/snapshot.ts # Agent Browser CLI wrapper
├── mcp/server.ts        # MCP server with Zod tools (list, search, get, ingest)
├── pipeline/ingest.ts   # Orchestration pipeline (discover → extract → LLM → store)
├── pipeline/wire.ts     # Dependency wiring for real ingest options
├── spider/discovery.ts  # Playwright-based URL discovery with priority queue
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

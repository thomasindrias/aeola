# Agent Store

## Purpose

Agent Store is an **Agent Engine Optimization (AEO)** infrastructure layer — it
makes e-commerce product data discoverable and consumable by AI agents, not just
human browsers.

Where SEO optimized websites for search engine crawlers, AEO optimizes data for
**agentic systems** — LLMs, shopping agents, and autonomous commerce protocols
that need structured, machine-readable product information to recommend,
compare, and transact on behalf of users. In the emerging agent economy, if your
products aren't in a format agents can consume, you're invisible.

Agent Store bridges this gap: it crawls traditional e-commerce sites,
dynamically extracts product data using LLMs (no hardcoded schemas), and serves
it via MCP — the open protocol that AI agents use to discover and consume
external data and tools.

### Where This Fits

- **AEO (Agent Engine Optimization)** — Making merchant data agent-readable so
  AI assistants (ChatGPT, Claude, Perplexity, etc.) can find, trust, and
  recommend products. The shift from "rank on page 1" to "be the answer the
  agent selects."
- **ACP (Agent Commerce Protocol)** — Protocols like Virtuals Protocol's ACP
  enable autonomous agent-to-agent commerce with on-chain escrow and
  verification. Agent Store provides the structured product catalog that these
  agent marketplaces need to function — agents can't buy what they can't
  discover.
- **MCP (Model Context Protocol)** — The open standard for how LLM applications
  connect to external data. Agent Store exposes product data as MCP tools,
  making any merchant's catalog instantly accessible to any MCP-compatible AI
  agent.

## Architecture

Five-component AI-first pipeline:

1. **Discovery** (Playwright) — Direct browser crawling with smart URL
   prioritization and dedup
2. **Extraction** (Agent Browser CLI) — Compact accessibility tree snapshots
   (~200-400 tokens per page)
3. **Brain** (OpenAI) — Dynamic schema inference from snapshots, no hardcoded
   schemas
4. **Storage** (SQLite) — Dynamic JSON storage with `@db/sqlite`
5. **Delivery** (MCP Server + REST API) — Streamable HTTP transport with Zod
   schemas, plus `/ingest` endpoint

## Tech Stack

- **Runtime:** Deno 2.x, TypeScript
- **Crawling:** Playwright (`npm:playwright`) — `chromium.launch()`, direct page
  navigation, link extraction
- **Extraction:** Agent Browser (CLI — `agent-browser`) — `open`,
  `snapshot -i -c`
- **AI:** OpenAI (`jsr:@openai/openai`) — `gpt-4o-mini`, dynamic schema
  extraction
- **Database:** SQLite (`jsr:@db/sqlite`) — WAL mode, JSON storage
- **MCP:** SDK v2 (`npm:@modelcontextprotocol/sdk`) — `McpServer`,
  `registerTool()`, Zod schemas
- **Transport:** `WebStandardStreamableHTTPServerTransport` (SSE is deprecated)
- **Container:** Docker with Playwright base image

## Key Decisions

- `"nodeModulesDir": "auto"` required in deno.json for Playwright/npm
  compatibility
- Agent Browser is a CLI tool — shell out via `Deno.Command`
- MCP SDK v2 uses `server.registerTool()` with `z.object()` Zod schemas
- All database query logic in `src/storage/db.ts` — single source of truth
- Dependency injection at boundaries for testability (`ingestFn` in
  server/handler)
- `@db/sqlite` auto-parses JSON from SQLite JSON functions
- URL scheme validation (http/https only) on all ingestion paths to prevent SSRF
- Playwright version must stay in sync between `deno.json` and `Dockerfile`
- Structured JSON logging via `src/utils/logger.ts` — injectable, level-filtered
- Exponential backoff retry on all external calls (OpenAI, agent-browser,
  Playwright)
- Product upsert on `(merchant_id, source_url)` — re-ingesting updates, not
  duplicates
- Rate limiting on `/ingest` only — sliding window per API key
- CORS headers on all responses, configurable via `CORS_ORIGINS` env var
- Registry notification is fire-and-forget with DI `fetchFn` for testability
- Landing page served as self-contained HTML with `{{STRIPE_PAYMENT_LINK}}`
  placeholder replaced at startup

## Project Structure

```
src/
├── main.ts              # HTTP server entry point (/health, /ingest, /mcp, /api/*, /openapi.json)
├── main_test.ts
├── api/
│   ├── openapi.ts       # OpenAPI 3.1 spec
│   ├── routes.ts        # REST API handler (merchants, products, search)
│   └── routes_test.ts
├── brain/extractor.ts   # OpenAI dynamic schema extraction (with retry)
├── extractor/snapshot.ts # Agent Browser CLI wrapper (with retry)
├── mcp/server.ts        # MCP server with Zod tools (list, search, get, ingest)
├── middleware/
│   ├── cors.ts          # CORS headers and preflight
│   └── ratelimit.ts     # Sliding window rate limiter for /ingest
├── pipeline/ingest.ts   # Orchestration pipeline (discover → extract → LLM → store)
├── pipeline/wire.ts     # Dependency wiring for real ingest options
├── registry/notify.ts   # Fire-and-forget registry notification (DI fetchFn)
├── spider/discovery.ts  # Playwright-based URL discovery with priority queue (with retry)
├── static/landing.html  # Landing page (shadcn-inspired, self-contained HTML)
├── storage/db.ts        # SQLite database layer (upsert, indices)
└── utils/
    ├── logger.ts        # Structured JSON logger
    └── retry.ts         # Exponential backoff retry
```

## Running

```bash
# Development (all env vars optional except API_KEY and OPENAI_API_KEY)
API_KEY=xxx OPENAI_API_KEY=xxx deno run --allow-all src/main.ts

# Tests
deno test --allow-all

# Lint + format check
deno fmt --check && deno lint

# Docker
docker compose up --build
```

## Environment Variables

| Variable              | Required | Default            | Description                                        |
| --------------------- | -------- | ------------------ | -------------------------------------------------- |
| `API_KEY`             | Yes      | —                  | Bearer token for authenticating requests           |
| `OPENAI_API_KEY`      | Yes      | —                  | OpenAI API key for product data extraction         |
| `DB_PATH`             | No       | `./agent-store.db` | SQLite database file path                          |
| `PORT`                | No       | `8000`             | HTTP server port                                   |
| `CONCURRENCY`         | No       | `3`                | Max concurrent extraction workers (max 20)         |
| `RATE_LIMIT`          | No       | `5`                | Max `/ingest` requests per minute per key          |
| `CORS_ORIGINS`        | No       | `*`                | Allowed CORS origin(s)                             |
| `LOG_LEVEL`           | No       | `info`             | Minimum log level (debug, info, warn, error)       |
| `STRIPE_PAYMENT_LINK` | No       | `#`                | Stripe Payment Link URL for managed cloud CTA      |
| `REGISTRY_ENABLED`    | No       | `false`            | Enable fire-and-forget registry notification       |
| `REGISTRY_URL`        | No       | —                  | Registry endpoint URL for post-ingest notification |

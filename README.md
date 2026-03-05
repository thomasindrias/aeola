# Aeola

[![Self-Host](https://img.shields.io/badge/Self--Host-Free-brightgreen)](#run-locally)
[![Managed Cloud](https://img.shields.io/badge/Aeola_Cloud-%2499%2Fmo-blue)](#)

**Agent Engine Optimization (AEO) infrastructure** — makes e-commerce product
data discoverable and consumable by AI agents via
[MCP](https://modelcontextprotocol.io/).

Where SEO optimized websites for search engine crawlers, AEO optimizes data for
agentic systems — LLMs, shopping agents, and autonomous commerce protocols that
need structured, machine-readable product information to recommend, compare, and
transact on behalf of users. In the emerging agent economy, if your products
aren't in a format agents can consume, you're invisible.

Give it a merchant URL — it discovers product pages, extracts compact
accessibility tree snapshots, dynamically infers schemas with OpenAI, and stores
structured JSON. AI agents query and ingest data through MCP tools or the REST
API.

## Architecture

```
                ┌───────────────┐
                │  Merchant URL │
                └───────┬───────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                 Ingestion Pipeline                  │
│                                                     │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐ │
│  │ Discovery  │    │ Extraction │    │   Brain    │ │
│  │ Playwright │───▶│ Agent      │───▶│   OpenAI   │ │
│  │ Priority   │    │ Browser    │    │   Dynamic  │ │
│  │ queue/dedup│    │ ~200 tk/pg │    │   schemas  │ │
│  └────────────┘    └────────────┘    └─────┬──────┘ │
│                                            │        │
└────────────────────────────────────────────┼────────┘
                                             │
                                             ▼
                                      ┌────────────┐
                                      │  Storage   │
                                      │  SQLite    │
                                      │  JSON data │
                                      └─────┬──────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │   Delivery   │
                                     │  MCP + REST  │
                                     └──────┬───────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         │                                  │                                  │
         ▼                                  ▼                                  ▼
  ┌────────────┐                     ┌────────────┐                     ┌────────────┐
  │   Claude   │                     │  ChatGPT   │                     │   Custom   │
  │   Agent    │                     │   Agent    │                     │   Agents   │
  └────────────┘                     └────────────┘                     └────────────┘
```

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) 2.x
- [Agent Browser](https://www.npmjs.com/package/agent-browser)
  (`npm install -g agent-browser`)
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Run Locally

```bash
cp .env.example .env
# Edit .env with your API keys

API_KEY=your-key OPENAI_API_KEY=your-openai-key deno run --allow-all src/main.ts
```

### Run with Docker

```bash
cp .env.example .env
# Edit .env with your API keys

docker compose up --build
```

The server starts on `http://localhost:8000`.

## API

Full API documentation available at `GET /openapi.json` (unauthenticated).

### REST Endpoints

| Endpoint                         | Method | Auth | Description                                          |
| -------------------------------- | ------ | ---- | ---------------------------------------------------- |
| `/`                              | GET    | No   | Landing page (when `landing.html` exists)            |
| `/health`                        | GET    | No   | Health check for load balancers / k8s probes         |
| `/openapi.json`                  | GET    | No   | OpenAPI 3.1 specification                            |
| `/ingest`                        | POST   | Yes  | Trigger merchant crawl and extraction (rate limited) |
| `/api/merchants`                 | GET    | Yes  | List all merchants                                   |
| `/api/merchants/:id`             | GET    | Yes  | Get merchant by ID                                   |
| `/api/merchants/:id/products`    | GET    | Yes  | List products by merchant (paginated)                |
| `/api/products/search?q=keyword` | GET    | Yes  | Search products by keyword (paginated)               |
| `/api/products/:id`              | GET    | Yes  | Get product by ID                                    |
| `/mcp`                           | POST   | Yes  | MCP protocol endpoint (streamable HTTP)              |

### Ingest a Merchant (REST)

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://shop.example.com", "name": "Example Shop"}'
```

### MCP Tools

| Tool              | Description                                       | Input                       |
| ----------------- | ------------------------------------------------- | --------------------------- |
| `list_products`   | List all products for a merchant                  | `merchantId: number`        |
| `search_products` | Search products by keyword                        | `query: string`             |
| `get_product`     | Get a single product by ID                        | `productId: number`         |
| `ingest_merchant` | Crawl and extract all product data (long-running) | `url: string, name: string` |

### Example: Connect an MCP Client

```bash
# Health check
curl http://localhost:8000/health

# MCP initialize
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0.0"}}}'

# List available tools
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Search products
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"shirt"}}}'
```

## Development

```bash
# Run tests
deno test --allow-all

# Run tests in watch mode
deno test --allow-all --watch

# Type check
deno check src/**/*.ts

# Lint
deno lint
```

## Project Structure

```
src/
├── main.ts                # HTTP server (/health, /ingest, /mcp, /api/*)
├── main_test.ts
├── api/
│   ├── openapi.ts         # OpenAPI 3.1 spec
│   ├── routes.ts          # REST API handler (merchants, products, search)
│   └── routes_test.ts
├── brain/
│   ├── extractor.ts       # OpenAI dynamic schema extraction (with retry)
│   └── extractor_test.ts
├── extractor/
│   ├── snapshot.ts        # Agent Browser CLI wrapper (with retry)
│   └── snapshot_test.ts
├── mcp/
│   ├── server.ts          # MCP server with Zod tool schemas
│   └── server_test.ts
├── middleware/
│   ├── cors.ts            # CORS headers and preflight
│   ├── cors_test.ts
│   ├── ratelimit.ts       # Sliding window rate limiter
│   └── ratelimit_test.ts
├── pipeline/
│   ├── ingest.ts          # Orchestration pipeline (concurrent, with logging)
│   ├── ingest_test.ts
│   ├── wire.ts            # Dependency wiring for real ingest options
│   └── wire_test.ts
├── registry/
│   ├── notify.ts          # Fire-and-forget registry notification
│   └── notify_test.ts
├── spider/
│   ├── discovery.ts       # Playwright-based URL discovery (with retry)
│   └── discovery_test.ts
├── storage/
│   ├── db.ts              # SQLite database layer (upsert, indices)
│   └── db_test.ts
├── static/
│   └── landing.html       # Landing page (shadcn-inspired, self-contained)
└── utils/
    ├── logger.ts          # Structured JSON logger
    ├── logger_test.ts
    ├── retry.ts           # Exponential backoff retry
    └── retry_test.ts
```

## Tech Stack

- **Runtime:** Deno 2.x, TypeScript
- **Crawling:** [Playwright](https://playwright.dev/) — Direct browser crawling,
  priority queue, dedup
- **Extraction:** [Agent Browser](https://www.npmjs.com/package/agent-browser) —
  Compact accessibility tree snapshots (~200-400 tokens/page)
- **AI:** OpenAI (`gpt-4o-mini`) — Dynamic schema inference, no hardcoded
  schemas
- **Database:** SQLite — WAL mode, JSON storage, parameterized queries
- **Protocol:** [MCP SDK v2](https://modelcontextprotocol.io/) — Streamable HTTP
  transport, Zod schemas
- **Container:** Docker with Playwright base image

## Environment Variables

| Variable              | Required | Default            | Description                                        |
| --------------------- | -------- | ------------------ | -------------------------------------------------- |
| `API_KEY`             | Yes      | —                  | Bearer token for authenticating requests           |
| `OPENAI_API_KEY`      | Yes      | —                  | OpenAI API key for product data extraction         |
| `DB_PATH`             | No       | `./aeola.db` | SQLite database file path                          |
| `PORT`                | No       | `8000`             | HTTP server port                                   |
| `CONCURRENCY`         | No       | `3`                | Max concurrent extraction workers (max 20)         |
| `RATE_LIMIT`          | No       | `5`                | Max `/ingest` requests per minute per key          |
| `CORS_ORIGINS`        | No       | `*`                | Allowed CORS origin(s)                             |
| `LOG_LEVEL`           | No       | `info`             | Minimum log level (debug, info, warn, error)       |
| `STRIPE_PAYMENT_LINK` | No       | `#`                | Stripe Payment Link URL for managed cloud CTA      |
| `REGISTRY_ENABLED`    | No       | `false`            | Enable fire-and-forget registry notification       |
| `REGISTRY_URL`        | No       | —                  | Registry endpoint URL for post-ingest notification |

## License

[AGPL-3.0](LICENSE)

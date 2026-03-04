# Agent Store

**Agent Engine Optimization (AEO) infrastructure** — makes e-commerce product data discoverable and consumable by AI agents via [MCP](https://modelcontextprotocol.io/).

Where SEO optimized websites for search engine crawlers, AEO optimizes data for agentic systems — LLMs, shopping agents, and autonomous commerce protocols that need structured, machine-readable product information to recommend, compare, and transact on behalf of users. In the emerging agent economy, if your products aren't in a format agents can consume, you're invisible.

Give it a merchant URL — it discovers product pages, extracts compact accessibility tree snapshots, dynamically infers schemas with OpenAI, and stores structured JSON. AI agents query and ingest data through MCP tools or the REST API.

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
- [Agent Browser](https://www.npmjs.com/package/agent-browser) (`npm install -g agent-browser`)
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

### REST Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check for load balancers / k8s probes |
| `/ingest` | POST | Yes | Trigger merchant crawl and extraction |
| `/mcp` | POST | Yes | MCP protocol endpoint (streamable HTTP) |

### Ingest a Merchant (REST)

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://shop.example.com", "name": "Example Shop"}'
```

### MCP Tools

| Tool | Description | Input |
|------|-------------|-------|
| `list_products` | List all products for a merchant | `merchantId: number` |
| `search_products` | Search products by keyword | `query: string` |
| `get_product` | Get a single product by ID | `productId: number` |
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
├── main.ts                # HTTP server (/health, /ingest, /mcp)
├── main_test.ts
├── brain/
│   ├── extractor.ts       # OpenAI dynamic schema extraction
│   └── extractor_test.ts
├── extractor/
│   ├── snapshot.ts        # Agent Browser CLI wrapper
│   └── snapshot_test.ts
├── mcp/
│   ├── server.ts          # MCP server with Zod tool schemas
│   └── server_test.ts
├── pipeline/
│   ├── ingest.ts          # Orchestration pipeline (concurrent)
│   ├── ingest_test.ts
│   ├── wire.ts            # Dependency wiring for real ingest options
│   └── wire_test.ts
├── spider/
│   ├── discovery.ts       # Playwright-based URL discovery
│   └── discovery_test.ts
└── storage/
    ├── db.ts              # SQLite database layer
    └── db_test.ts
```

## Tech Stack

- **Runtime:** Deno 2.x, TypeScript
- **Crawling:** [Playwright](https://playwright.dev/) — Direct browser crawling, priority queue, dedup
- **Extraction:** [Agent Browser](https://www.npmjs.com/package/agent-browser) — Compact accessibility tree snapshots (~200-400 tokens/page)
- **AI:** OpenAI (`gpt-4o-mini`) — Dynamic schema inference, no hardcoded schemas
- **Database:** SQLite — WAL mode, JSON storage, parameterized queries
- **Protocol:** [MCP SDK v2](https://modelcontextprotocol.io/) — Streamable HTTP transport, Zod schemas
- **Container:** Docker with Playwright base image

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | Yes | — | Bearer token for authenticating MCP requests |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for product data extraction |
| `DB_PATH` | No | `./agent-store.db` | SQLite database file path |
| `PORT` | No | `8000` | HTTP server port |

## License

[MIT](LICENSE)

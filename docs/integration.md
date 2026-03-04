# Integration Guide

## REST API

### cURL Cookbook

```bash
# Health check
curl http://localhost:8000/health

# OpenAPI spec
curl http://localhost:8000/openapi.json

# Ingest a merchant
curl -X POST http://localhost:8000/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://shop.example.com", "name": "Example Shop"}'

# List merchants
curl http://localhost:8000/api/merchants \
  -H "Authorization: Bearer $API_KEY"

# Get merchant by ID
curl http://localhost:8000/api/merchants/1 \
  -H "Authorization: Bearer $API_KEY"

# List products by merchant (paginated)
curl "http://localhost:8000/api/merchants/1/products?limit=10&offset=0" \
  -H "Authorization: Bearer $API_KEY"

# Search products
curl "http://localhost:8000/api/products/search?q=shirt&limit=10" \
  -H "Authorization: Bearer $API_KEY"

# Get product by ID
curl http://localhost:8000/api/products/1 \
  -H "Authorization: Bearer $API_KEY"
```

## TypeScript Client

```typescript
const BASE = "http://localhost:8000";
const API_KEY = "your-api-key";

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// Ingest a merchant
const ingestResult = await fetch(`${BASE}/ingest`, {
  method: "POST",
  headers,
  body: JSON.stringify({ url: "https://shop.example.com", name: "Shop" }),
}).then((r) => r.json());

console.log(`Ingested ${ingestResult.productsIngested} products`);

// Search products
const products = await fetch(`${BASE}/api/products/search?q=shirt`, {
  headers,
}).then((r) => r.json());

console.log(products);
```

## Python Client

```python
import httpx

BASE = "http://localhost:8000"
HEADERS = {"Authorization": "Bearer your-api-key"}

# Ingest a merchant
result = httpx.post(
    f"{BASE}/ingest",
    headers=HEADERS,
    json={"url": "https://shop.example.com", "name": "Shop"},
).json()
print(f"Ingested {result['productsIngested']} products")

# Search products
products = httpx.get(
    f"{BASE}/api/products/search",
    headers=HEADERS,
    params={"q": "shirt", "limit": 10},
).json()
print(products)

# List merchants
merchants = httpx.get(f"{BASE}/api/merchants", headers=HEADERS).json()
print(merchants)
```

## MCP Client

Use the [MCP SDK](https://modelcontextprotocol.io/) to connect:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:8000/mcp"),
  {
    requestInit: {
      headers: { Authorization: "Bearer your-api-key" },
    },
  },
);

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools);

// Search products
const result = await client.callTool({
  name: "search_products",
  arguments: { query: "shirt" },
});
console.log(result);
```

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Database } from "@db/sqlite";
import { getProductsByMerchant, searchProducts, getProduct } from "../storage/db.ts";

export function createMcpServer(db: Database): McpServer {
  const server = new McpServer({
    name: "agentstore-mcp-bridge",
    version: "1.0.0",
  });

  server.registerTool(
    "list_products",
    {
      description: "List all products for a given merchant",
      inputSchema: z.object({
        merchantId: z.number().describe("The merchant ID"),
      }),
    },
    async ({ merchantId }) => {
      const products = getProductsByMerchant(db, merchantId);
      return { content: [{ type: "text" as const, text: JSON.stringify(products) }] };
    },
  );

  server.registerTool(
    "search_products",
    {
      description: "Search products across all merchants by keyword",
      inputSchema: z.object({
        query: z.string().describe("Search keyword"),
      }),
    },
    async ({ query }) => {
      const products = searchProducts(db, query);
      return { content: [{ type: "text" as const, text: JSON.stringify(products) }] };
    },
  );

  server.registerTool(
    "get_product",
    {
      description: "Get a single product by its ID",
      inputSchema: z.object({
        productId: z.number().describe("The product ID"),
      }),
    },
    async ({ productId }) => {
      const product = getProduct(db, productId);
      if (!product) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Product not found" }) }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(product) }] };
    },
  );

  return server;
}

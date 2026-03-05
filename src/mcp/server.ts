import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Database } from "@db/sqlite";
import {
  getProduct,
  getProductsByMerchant,
  searchProducts,
} from "../storage/db.ts";
import { buildIngestOptions } from "../pipeline/wire.ts";
import { ingestMerchant, type IngestResult } from "../pipeline/ingest.ts";

async function defaultIngest(
  db: Database,
  url: string,
  name: string,
): Promise<IngestResult> {
  const options = buildIngestOptions(url, name);
  return await ingestMerchant(db, options);
}

export function createMcpServer(
  db: Database,
  options?: {
    ingestFn?: (
      db: Database,
      url: string,
      name: string,
    ) => Promise<IngestResult>;
  },
): McpServer {
  const ingestFn = options?.ingestFn ?? defaultIngest;
  const server = new McpServer({
    name: "aeola",
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
    ({ merchantId }) => {
      const products = getProductsByMerchant(db, merchantId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(products) }],
      };
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
    ({ query }) => {
      const products = searchProducts(db, query);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(products) }],
      };
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
    ({ productId }) => {
      const product = getProduct(db, productId);
      if (!product) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "Product not found" }),
          }],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(product) }],
      };
    },
  );

  server.registerTool(
    "ingest_merchant",
    {
      description:
        "Crawl an e-commerce website and extract all product data. This is a long-running operation.",
      inputSchema: z.object({
        url: z.string().url().describe("The merchant website URL"),
        name: z.string().describe("A name for this merchant"),
      }),
    },
    async ({ url, name }) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "Only http/https URLs are supported",
              }),
            }],
            isError: true,
          };
        }
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "Invalid URL" }),
          }],
          isError: true,
        };
      }
      const result = await ingestFn(db, url, name);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  return server;
}

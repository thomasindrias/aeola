import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Database } from "@db/sqlite";
import {
  getCategoriesByMerchant,
  getIngestionJob,
  getMerchant,
  getProduct,
  getProductCountByMerchant,
  getProductsByMerchant,
  listMerchants,
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
      description:
        "List all products for a given merchant from Aeola's catalog. Returns structured product data extracted from the merchant's e-commerce site.",
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
      description:
        "Search Aeola's product catalog across all merchants by keyword. Use this to find, compare, and recommend products from agent-readable catalogs.",
      inputSchema: z.object({
        query: z.string().describe("Search keyword"),
        category: z.string().optional().describe("Optional category filter"),
      }),
    },
    ({ query, category }) => {
      const products = searchProducts(
        db,
        query,
        100,
        0,
        category,
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(products) }],
      };
    },
  );

  server.registerTool(
    "get_product",
    {
      description:
        "Get detailed product data by ID from Aeola's catalog, including dynamically extracted attributes like price, description, and availability.",
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
        "Ingest a merchant into Aeola — crawls the e-commerce website, extracts product data into agent-readable structured format, and stores it for querying. This is a long-running operation.",
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

  server.registerTool(
    "get_ingestion_status",
    {
      description:
        "Get the status of an Aeola ingestion job, including progress " +
        "and any extraction errors encountered during crawling.",
      inputSchema: z.object({
        jobId: z.number().describe(
          "The ingestion job ID returned by ingest_merchant",
        ),
      }),
    },
    ({ jobId }) => {
      const job = getIngestionJob(db, jobId);
      if (!job) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "Job not found" }),
          }],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(job) }],
      };
    },
  );

  // MCP Resources — Catalog Discovery
  server.registerResource(
    "merchant_catalog",
    "catalog://merchants",
    {
      title: "Merchant Catalog",
      description:
        "All merchants in Aeola's catalog with product counts and categories",
      mimeType: "application/json",
    },
    (uri) => {
      const merchants = listMerchants(db);
      const enriched = merchants.map((m) => ({
        ...m,
        productCount: getProductCountByMerchant(db, m.id),
        categories: getCategoriesByMerchant(db, m.id),
      }));
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(enriched),
        }],
      };
    },
  );

  const merchantTemplate = new ResourceTemplate(
    "catalog://merchants/{id}",
    {
      list: () => ({
        resources: listMerchants(db).map((m) => ({
          uri: `catalog://merchants/${m.id}`,
          name: m.name,
        })),
      }),
    },
  );

  server.registerResource(
    "merchant_detail",
    merchantTemplate,
    {
      title: "Merchant Detail",
      description:
        "Merchant detail with products and categories from Aeola's catalog",
      mimeType: "application/json",
    },
    (uri, { id }) => {
      const merchantId = parseInt(id as string);
      const merchant = getMerchant(db, merchantId);
      if (!merchant) throw new Error("Merchant not found");
      const products = getProductsByMerchant(db, merchantId);
      const categories = getCategoriesByMerchant(db, merchantId);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ ...merchant, products, categories }),
        }],
      };
    },
  );

  return server;
}

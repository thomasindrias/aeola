import { describe, it, afterEach } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { ingestMerchant } from "./ingest.ts";
import { createDatabase, getProductsByMerchant } from "../storage/db.ts";

describe("Ingestion Pipeline", () => {
  let db: ReturnType<typeof createDatabase>;

  afterEach(() => {
    db?.close();
  });

  it("should discover URLs, extract snapshots, process with LLM, and store products", async () => {
    db = createDatabase(":memory:");

    const result = await ingestMerchant(db, {
      url: "https://shop.example.com",
      name: "Example Shop",
      discover: async () => [
        "https://shop.example.com/product/1",
        "https://shop.example.com/product/2",
      ],
      extractSnapshot: async (url) => `@e1 [heading] "Product from ${url}" [level=1]\n@e2 [text] "Price: $29.99"`,
      processWithLLM: async (_client, _text) => ({
        schema: { type: "product", properties: { name: "string", price: "number" } },
        data: { name: "Blue T-Shirt", price: 29.99 },
      }),
    });

    assertEquals(result.productsIngested, 2);
    assertEquals(result.errors.length, 0);
    const products = getProductsByMerchant(db, result.merchantId);
    assertEquals(products.length, 2);
  });

  it("should continue when one extraction fails", async () => {
    db = createDatabase(":memory:");
    let callCount = 0;

    const result = await ingestMerchant(db, {
      url: "https://shop.example.com",
      name: "Example Shop",
      discover: async () => [
        "https://shop.example.com/product/1",
        "https://shop.example.com/product/2",
      ],
      extractSnapshot: async (url) => {
        callCount++;
        if (callCount === 1) throw new Error("Snapshot failed");
        return `@e1 [heading] "Widget" [level=1]`;
      },
      processWithLLM: async () => ({
        schema: { type: "product" },
        data: { name: "Widget", price: 10 },
      }),
    });

    assertEquals(result.productsIngested, 1);
    assertEquals(result.errors.length, 1);
    assertEquals(result.errors[0].includes("product/1"), true);
  });

  it("should handle zero discovered URLs gracefully", async () => {
    db = createDatabase(":memory:");

    const result = await ingestMerchant(db, {
      url: "https://empty.example.com",
      name: "Empty Shop",
      discover: async () => [],
      extractSnapshot: async () => "",
      processWithLLM: async () => ({ schema: {}, data: {} }),
    });

    assertEquals(result.productsIngested, 0);
    assertEquals(result.errors.length, 0);
  });
});

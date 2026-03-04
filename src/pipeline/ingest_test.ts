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
      discover: () => Promise.resolve([
        "https://shop.example.com/product/1",
        "https://shop.example.com/product/2",
      ]),
      extractSnapshot: (url) => Promise.resolve(`@e1 [heading] "Product from ${url}" [level=1]\n@e2 [text] "Price: $29.99"`),
      processWithLLM: (_client, _snapshot, _sourceUrl) => Promise.resolve({
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
      discover: () => Promise.resolve([
        "https://shop.example.com/product/1",
        "https://shop.example.com/product/2",
      ]),
      extractSnapshot: (_url) => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("Snapshot failed"));
        return Promise.resolve(`@e1 [heading] "Widget" [level=1]`);
      },
      processWithLLM: (_client, _snapshot, _sourceUrl) => Promise.resolve({
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
      discover: () => Promise.resolve([]),
      extractSnapshot: () => Promise.resolve(""),
      processWithLLM: (_client, _snapshot, _sourceUrl) => Promise.resolve({ schema: {}, data: {} }),
    });

    assertEquals(result.productsIngested, 0);
    assertEquals(result.errors.length, 0);
  });

  it("should pass product URL to processWithLLM", async () => {
    db = createDatabase(":memory:");
    const receivedUrls: string[] = [];

    const result = await ingestMerchant(db, {
      url: "https://shop.example.com",
      name: "URL Test Shop",
      discover: () => Promise.resolve([
        "https://shop.example.com/product/abc",
      ]),
      extractSnapshot: () => Promise.resolve(`@e1 [heading] "Product" [level=1]\n@e2 [text] "Price: $29.99"`),
      processWithLLM: (_client, _snapshot, sourceUrl) => {
        receivedUrls.push(sourceUrl);
        return Promise.resolve({
          schema: { type: "product" },
          data: { name: "Widget", price: 5 },
        });
      },
    });

    assertEquals(result.productsIngested, 1);
    assertEquals(receivedUrls, ["https://shop.example.com/product/abc"]);
  });

  it("should process products concurrently", async () => {
    db = createDatabase(":memory:");
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const urls = Array.from({ length: 10 }, (_, i) => `https://shop.example.com/product/${i}`);

    const result = await ingestMerchant(db, {
      url: "https://shop.example.com",
      name: "Concurrent Shop",
      discover: () => Promise.resolve(urls),
      extractSnapshot: async (_url) => {
        currentConcurrent++;
        if (currentConcurrent > maxConcurrent) maxConcurrent = currentConcurrent;
        // Simulate async work
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrent--;
        return `@e1 [heading] "Product" [level=1]`;
      },
      processWithLLM: (_client, _snapshot, _sourceUrl) => Promise.resolve({
        schema: { type: "product" },
        data: { name: "Widget", price: 5 },
      }),
      concurrency: 3,
    });

    assertEquals(result.productsIngested, 10);
    assertEquals(result.errors.length, 0);
    // With concurrency=3 and 10 items, max concurrent should be <= 3
    assertEquals(maxConcurrent <= 3, true);
    // Should have actually run concurrently (max > 1)
    assertEquals(maxConcurrent > 1, true);
  });
});

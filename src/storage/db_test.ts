import { afterEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertThrows } from "@std/assert";
import {
  addExtractionError,
  addMerchant,
  addProduct,
  addProductCategories,
  createDatabase,
  createIngestionJob,
  getCategoriesByMerchant,
  getIngestionJob,
  getJobsByMerchant,
  getMerchant,
  getOrCreateMerchant,
  getProduct,
  getProductCountByMerchant,
  getProductsByCategory,
  getProductsByMerchant,
  listCategories,
  listMerchants,
  searchProducts,
  updateJobStatus,
} from "./db.ts";

describe("Storage Layer", () => {
  let db: ReturnType<typeof createDatabase>;

  afterEach(() => {
    db?.close();
  });

  describe("createDatabase", () => {
    it("should create an in-memory database with merchants and products tables", () => {
      db = createDatabase(":memory:");
      assertExists(db);
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      ).all<{ name: string }>();
      const tableNames = tables.map((t) => t.name);
      assertEquals(tableNames.includes("merchants"), true);
      assertEquals(tableNames.includes("products"), true);
    });
  });

  describe("merchants", () => {
    it("should add and retrieve a merchant by id", () => {
      db = createDatabase(":memory:");
      const id = addMerchant(db, {
        url: "https://shop.example.com",
        name: "Example Shop",
      });
      assertExists(id);
      const merchant = getMerchant(db, id);
      assertEquals(merchant?.url, "https://shop.example.com");
      assertEquals(merchant?.name, "Example Shop");
    });

    it("should reject duplicate merchant URLs", () => {
      db = createDatabase(":memory:");
      addMerchant(db, { url: "https://shop.example.com", name: "Shop 1" });
      assertThrows(
        () =>
          addMerchant(db, { url: "https://shop.example.com", name: "Shop 2" }),
      );
    });
  });

  describe("products", () => {
    it("should store dynamic JSON data and retrieve by merchant", () => {
      db = createDatabase(":memory:");
      const merchantId = addMerchant(db, {
        url: "https://shop.example.com",
        name: "Example Shop",
      });
      addProduct(db, {
        merchantId,
        sourceUrl: "https://shop.example.com/product/1",
        data: { title: "Blue T-Shirt", price: 29.99, sizes: ["S", "M", "L"] },
        schema: {
          type: "product",
          properties: { title: "string", price: "number" },
        },
      });
      const products = getProductsByMerchant(db, merchantId);
      assertEquals(products.length, 1);
      assertEquals(products[0].data.title, "Blue T-Shirt");
      assertEquals(products[0].data.price, 29.99);
      assertEquals(products[0].sourceUrl, "https://shop.example.com/product/1");
    });

    it("should retrieve a single product by id", () => {
      db = createDatabase(":memory:");
      const merchantId = addMerchant(db, {
        url: "https://shop.example.com",
        name: "Shop",
      });
      const productId = addProduct(db, {
        merchantId,
        sourceUrl: "https://shop.example.com/p/1",
        data: { name: "Widget" },
        schema: { type: "product" },
      });
      const product = getProduct(db, productId);
      assertEquals(product?.data.name, "Widget");
    });

    it("should return undefined for non-existent product", () => {
      db = createDatabase(":memory:");
      const product = getProduct(db, 999);
      assertEquals(product, undefined);
    });

    it("should search products by keyword in JSON data", () => {
      db = createDatabase(":memory:");
      const merchantId = addMerchant(db, {
        url: "https://shop.example.com",
        name: "Shop",
      });
      addProduct(db, {
        merchantId,
        sourceUrl: "https://shop.example.com/p/1",
        data: { name: "Blue Widget", color: "blue" },
        schema: { type: "product" },
      });
      addProduct(db, {
        merchantId,
        sourceUrl: "https://shop.example.com/p/2",
        data: { name: "Red Gadget", color: "red" },
        schema: { type: "product" },
      });

      const results = searchProducts(db, "blue");
      assertEquals(results.length, 1);
      assertEquals(results[0].data.name, "Blue Widget");
    });

    it("should return empty array when no products match search", () => {
      db = createDatabase(":memory:");
      const results = searchProducts(db, "nonexistent");
      assertEquals(results.length, 0);
    });

    it("should upsert product on duplicate source_url for same merchant", () => {
      db = createDatabase(":memory:");
      const merchantId = addMerchant(db, {
        url: "https://example.com",
        name: "Test",
      });

      addProduct(db, {
        merchantId,
        sourceUrl: "https://example.com/p/1",
        data: { name: "V1" },
        schema: {},
      });
      addProduct(db, {
        merchantId,
        sourceUrl: "https://example.com/p/1",
        data: { name: "V2" },
        schema: {},
      });

      const products = getProductsByMerchant(db, merchantId);
      assertEquals(products.length, 1);
      assertEquals(products[0].data.name, "V2");
    });
  });

  describe("getOrCreateMerchant", () => {
    it("should return existing merchant on duplicate URL", () => {
      db = createDatabase(":memory:");
      const id1 = getOrCreateMerchant(db, {
        url: "https://example.com",
        name: "Test",
      });
      const id2 = getOrCreateMerchant(db, {
        url: "https://example.com",
        name: "Test Updated",
      });
      assertEquals(id1, id2);
    });
  });

  describe("listMerchants", () => {
    it("should list all merchants", () => {
      db = createDatabase(":memory:");
      addMerchant(db, { url: "https://shop1.com", name: "Shop 1" });
      addMerchant(db, { url: "https://shop2.com", name: "Shop 2" });
      const merchants = listMerchants(db);
      assertEquals(merchants.length, 2);
    });
  });

  describe("ingestion_jobs", () => {
    it("should create a job with pending status", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const jobId = createIngestionJob(db, mid);
      const job = getIngestionJob(db, jobId);
      assertExists(job);
      assertEquals(job.status, "pending");
      assertEquals(job.merchantId, mid);
      assertEquals(job.urlsDiscovered, 0);
      assertEquals(job.productsExtracted, 0);
      assertEquals(job.productsFailed, 0);
    });

    it("should update job status from pending to in_progress", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const jobId = createIngestionJob(db, mid);
      updateJobStatus(db, jobId, "in_progress", {
        startedAt: "2026-01-01T00:00:00",
      });
      const job = getIngestionJob(db, jobId);
      assertEquals(job?.status, "in_progress");
      assertEquals(job?.startedAt, "2026-01-01T00:00:00");
    });

    it("should update job to completed with counters", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const jobId = createIngestionJob(db, mid);
      updateJobStatus(db, jobId, "completed", {
        completedAt: "2026-01-01T00:01:00",
        urlsDiscovered: 10,
        productsExtracted: 8,
        productsFailed: 2,
      });
      const job = getIngestionJob(db, jobId);
      assertEquals(job?.status, "completed");
      assertEquals(job?.urlsDiscovered, 10);
      assertEquals(job?.productsExtracted, 8);
      assertEquals(job?.productsFailed, 2);
    });

    it("should update job to failed status", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const jobId = createIngestionJob(db, mid);
      updateJobStatus(db, jobId, "failed");
      const job = getIngestionJob(db, jobId);
      assertEquals(job?.status, "failed");
    });

    it("should add extraction errors and retrieve with job detail", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const jobId = createIngestionJob(db, mid);
      addExtractionError(db, jobId, "https://shop.com/p/1", "timeout");
      addExtractionError(db, jobId, "https://shop.com/p/2", "parse error");
      const job = getIngestionJob(db, jobId);
      assertExists(job);
      assertEquals(job.errors.length, 2);
      assertEquals(job.errors[0].sourceUrl, "https://shop.com/p/1");
      assertEquals(job.errors[0].errorMessage, "timeout");
      assertEquals(job.errors[1].sourceUrl, "https://shop.com/p/2");
    });

    it("should list jobs by merchant with pagination", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      createIngestionJob(db, mid);
      createIngestionJob(db, mid);
      createIngestionJob(db, mid);
      const page1 = getJobsByMerchant(db, mid, 2, 0);
      assertEquals(page1.length, 2);
      const page2 = getJobsByMerchant(db, mid, 2, 2);
      assertEquals(page2.length, 1);
    });
  });

  describe("product_categories", () => {
    it("should add categories for a product", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const pid = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/1",
        data: { name: "Widget" },
        schema: {},
      });
      addProductCategories(db, pid, ["electronics", "gadgets"]);
      const cats = listCategories(db);
      assertEquals(cats.length, 2);
    });

    it("should ignore duplicate categories (UNIQUE constraint)", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const pid = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/1",
        data: { name: "Widget" },
        schema: {},
      });
      addProductCategories(db, pid, ["electronics"]);
      addProductCategories(db, pid, ["electronics"]);
      const cats = listCategories(db);
      assertEquals(cats.length, 1);
    });

    it("should list all categories with product counts", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const p1 = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/1",
        data: { name: "A" },
        schema: {},
      });
      const p2 = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/2",
        data: { name: "B" },
        schema: {},
      });
      addProductCategories(db, p1, ["electronics"]);
      addProductCategories(db, p2, ["electronics", "clothing"]);
      const cats = listCategories(db);
      assertEquals(cats[0].category, "electronics");
      assertEquals(cats[0].productCount, 2);
      assertEquals(cats[1].category, "clothing");
      assertEquals(cats[1].productCount, 1);
    });

    it("should get products by category", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const p1 = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/1",
        data: { name: "A" },
        schema: {},
      });
      const p2 = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/2",
        data: { name: "B" },
        schema: {},
      });
      addProductCategories(db, p1, ["electronics"]);
      addProductCategories(db, p2, ["clothing"]);
      const products = getProductsByCategory(db, "electronics");
      assertEquals(products.length, 1);
      assertEquals(products[0].data.name, "A");
    });

    it("should get categories for a merchant", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const pid = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/1",
        data: { name: "A" },
        schema: {},
      });
      addProductCategories(db, pid, ["electronics", "gadgets"]);
      const cats = getCategoriesByMerchant(db, mid);
      assertEquals(cats.length, 2);
      assertEquals(cats.includes("electronics"), true);
      assertEquals(cats.includes("gadgets"), true);
    });

    it("should get product count by merchant efficiently", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/1",
        data: { name: "A" },
        schema: {},
      });
      addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/2",
        data: { name: "B" },
        schema: {},
      });
      assertEquals(getProductCountByMerchant(db, mid), 2);
    });

    it("should filter search results by category", () => {
      db = createDatabase(":memory:");
      const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
      const p1 = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/1",
        data: { name: "Blue Widget" },
        schema: {},
      });
      const p2 = addProduct(db, {
        merchantId: mid,
        sourceUrl: "https://shop.com/p/2",
        data: { name: "Blue Shirt" },
        schema: {},
      });
      addProductCategories(db, p1, ["electronics"]);
      addProductCategories(db, p2, ["clothing"]);
      const results = searchProducts(db, "Blue", 100, 0, "electronics");
      assertEquals(results.length, 1);
      assertEquals(results[0].data.name, "Blue Widget");
    });

    it("should filter search results by merchantId", () => {
      db = createDatabase(":memory:");
      const m1 = addMerchant(db, { url: "https://a.com", name: "A" });
      const m2 = addMerchant(db, { url: "https://b.com", name: "B" });
      addProduct(db, {
        merchantId: m1,
        sourceUrl: "https://a.com/p/1",
        data: { name: "Widget" },
        schema: {},
      });
      addProduct(db, {
        merchantId: m2,
        sourceUrl: "https://b.com/p/1",
        data: { name: "Widget" },
        schema: {},
      });
      const results = searchProducts(db, "Widget", 100, 0, undefined, m1);
      assertEquals(results.length, 1);
      assertEquals(results[0].merchantId, m1);
    });
  });
});

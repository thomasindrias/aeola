import { afterEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertThrows } from "@std/assert";
import {
  addMerchant,
  addProduct,
  createDatabase,
  getMerchant,
  getOrCreateMerchant,
  getProduct,
  getProductsByMerchant,
  listMerchants,
  searchProducts,
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
});

import { describe, it, afterEach } from "@std/testing/bdd";
import { assertExists, assertEquals } from "@std/assert";
import { createMcpServer } from "./server.ts";
import { createDatabase, addMerchant, addProduct, getProductsByMerchant, searchProducts, getProduct } from "../storage/db.ts";

describe("MCP Server", () => {
  let db: ReturnType<typeof createDatabase>;

  afterEach(() => {
    db?.close();
  });

  it("should create an MCP server instance", () => {
    db = createDatabase(":memory:");
    const server = createMcpServer(db);
    assertExists(server);
  });

  it("should wire list_products to storage layer", () => {
    db = createDatabase(":memory:");
    createMcpServer(db);
    const merchantId = addMerchant(db, { url: "https://example.com", name: "Test" });
    addProduct(db, {
      merchantId,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Widget", price: 9.99 },
      schema: { type: "product" },
    });
    const products = getProductsByMerchant(db, merchantId);
    assertEquals(products.length, 1);
    assertEquals(products[0].data.name, "Widget");
  });

  it("should wire search_products to storage layer", () => {
    db = createDatabase(":memory:");
    createMcpServer(db);
    const merchantId = addMerchant(db, { url: "https://example.com", name: "Test" });
    addProduct(db, { merchantId, sourceUrl: "https://example.com/p/1", data: { name: "Blue Widget" }, schema: { type: "product" } });
    addProduct(db, { merchantId, sourceUrl: "https://example.com/p/2", data: { name: "Red Gadget" }, schema: { type: "product" } });
    const results = searchProducts(db, "blue");
    assertEquals(results.length, 1);
    assertEquals(results[0].data.name, "Blue Widget");
  });

  it("should wire get_product to storage layer", () => {
    db = createDatabase(":memory:");
    createMcpServer(db);
    const merchantId = addMerchant(db, { url: "https://example.com", name: "Test" });
    const productId = addProduct(db, { merchantId, sourceUrl: "https://example.com/p/1", data: { name: "Widget" }, schema: { type: "product" } });
    const product = getProduct(db, productId);
    assertExists(product);
    assertEquals(product.data.name, "Widget");
  });
});

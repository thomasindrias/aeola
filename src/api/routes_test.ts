import { describe, it, afterEach } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { createDatabase, addMerchant, addProduct } from "../storage/db.ts";
import { createApiHandler } from "./routes.ts";

describe("REST API", () => {
  let db: ReturnType<typeof createDatabase>;
  afterEach(() => {
    db?.close();
  });

  it("should list merchants", async () => {
    db = createDatabase(":memory:");
    addMerchant(db, { url: "https://shop.com", name: "Shop" });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/merchants"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
    assertEquals(body[0].name, "Shop");
  });

  it("should get merchant by id", async () => {
    db = createDatabase(":memory:");
    addMerchant(db, { url: "https://shop.com", name: "Shop" });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/merchants/1"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.name, "Shop");
  });

  it("should return 404 for non-existent merchant", async () => {
    db = createDatabase(":memory:");
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/merchants/999"),
    );
    assertEquals(response?.status, 404);
  });

  it("should get products by merchant with pagination", async () => {
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
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/merchants/1/products?limit=1&offset=0"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
  });

  it("should search products", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "Blue Shirt" },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/products/search?q=Blue"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
  });

  it("should get product by id", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "Widget" },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/products/1"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.data.name, "Widget");
  });

  it("should return null for unknown API routes", async () => {
    db = createDatabase(":memory:");
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/unknown"),
    );
    assertEquals(response, null);
  });
});

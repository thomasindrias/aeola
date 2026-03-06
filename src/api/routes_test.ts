import { afterEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  addMerchant,
  addProduct,
  addProductCategories,
  createDatabase,
  createIngestionJob,
  updateJobStatus,
} from "../storage/db.ts";
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

  it("should list jobs for a merchant", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    createIngestionJob(db, mid);
    createIngestionJob(db, mid);
    const handler = createApiHandler(db);
    const response = await handler(
      new Request(`http://localhost/api/merchants/${mid}/jobs`),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 2);
  });

  it("should return empty array for merchant with no jobs", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request(`http://localhost/api/merchants/${mid}/jobs`),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 0);
  });

  it("should get job detail with errors", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    const jobId = createIngestionJob(db, mid);
    updateJobStatus(db, jobId, "completed", { productsExtracted: 1 });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request(`http://localhost/api/jobs/${jobId}`),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.status, "completed");
    assertEquals(Array.isArray(body.errors), true);
  });

  it("should return 404 for non-existent job", async () => {
    db = createDatabase(":memory:");
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/jobs/999"),
    );
    assertEquals(response?.status, 404);
  });

  it("should list all categories with product counts", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    const p1 = addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "A" },
      schema: {},
    });
    addProductCategories(db, p1, ["electronics"]);
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/categories"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
    assertEquals(body[0].category, "electronics");
    assertEquals(body[0].productCount, 1);
  });

  it("should get products by category", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    const p1 = addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "Widget" },
      schema: {},
    });
    addProductCategories(db, p1, ["electronics"]);
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/categories/electronics/products"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
    assertEquals(body[0].data.name, "Widget");
  });

  it("should return products in Google Merchant format for a merchant", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "Widget", price: 19.99, currency: "USD" },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request(`http://localhost/api/ucp/merchants/${mid}/products`),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
    assertEquals(body[0].offerId, "1");
    assertEquals(body[0].productAttributes.title, "Widget");
    assertEquals(body[0].productAttributes.price.value, "19.99");
    assertEquals(body[0].link, "https://shop.com/p/1");
  });

  it("should return single product in Google Merchant format", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "Gadget" },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/ucp/products/1"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.offerId, "1");
    assertEquals(body.productAttributes.title, "Gadget");
  });

  it("should return 404 for non-existent UCP product", async () => {
    db = createDatabase(":memory:");
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/ucp/products/999"),
    );
    assertEquals(response?.status, 404);
  });

  it("should support pagination on UCP merchant products", async () => {
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
      new Request(
        `http://localhost/api/ucp/merchants/${mid}/products?limit=1&offset=0`,
      ),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
  });

  it("should return UCP search results in Google Merchant format", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "Blue Widget", price: 19.99, currency: "USD" },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/ucp/products/search?q=Blue"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
    assertEquals(body[0].offerId, "1");
    assertEquals(body[0].productAttributes.title, "Blue Widget");
    assertEquals(body[0].productAttributes.price.value, "19.99");
  });

  it("should return UCP search results for empty query", async () => {
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
      new Request("http://localhost/api/ucp/products/search"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(Array.isArray(body), true);
  });

  it("should return empty array for UCP search with no matches", async () => {
    db = createDatabase(":memory:");
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/ucp/products/search?q=nonexistent"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 0);
  });

  it("should support pagination on UCP search", async () => {
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
      new Request("http://localhost/api/ucp/products/search?limit=1"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
  });

  it("should map UCP search results with correct price and availability", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: {
        name: "Fancy Item",
        price: "$29.99",
        availability: "in_stock",
        color: "red",
      },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request("http://localhost/api/ucp/products/search?q=Fancy"),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body[0].productAttributes.price.value, "29.99");
    assertEquals(body[0].productAttributes.availability, "in_stock");
    assertEquals(body[0].productAttributes.additionalAttributes.color, "red");
  });

  it("should filter UCP search by merchant_id", async () => {
    db = createDatabase(":memory:");
    const m1 = addMerchant(db, { url: "https://shop1.com", name: "Shop1" });
    const m2 = addMerchant(db, { url: "https://shop2.com", name: "Shop2" });
    addProduct(db, {
      merchantId: m1,
      sourceUrl: "https://shop1.com/p/1",
      data: { name: "Widget" },
      schema: {},
    });
    addProduct(db, {
      merchantId: m2,
      sourceUrl: "https://shop2.com/p/1",
      data: { name: "Widget" },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request(
        `http://localhost/api/ucp/products/search?q=Widget&merchant_id=${m1}`,
      ),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
    assertEquals(body[0].link, "https://shop1.com/p/1");
  });

  it("should fall back to defaults for non-numeric limit/offset", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "A" },
      schema: {},
    });
    const handler = createApiHandler(db);
    const response = await handler(
      new Request(
        "http://localhost/api/ucp/products/search?q=A&limit=abc&offset=xyz",
      ),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 1);
  });

  it("should get categories for a merchant", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, { url: "https://shop.com", name: "Shop" });
    const p1 = addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://shop.com/p/1",
      data: { name: "Widget" },
      schema: {},
    });
    addProductCategories(db, p1, ["electronics", "gadgets"]);
    const handler = createApiHandler(db);
    const response = await handler(
      new Request(`http://localhost/api/merchants/${mid}/categories`),
    );
    assertEquals(response?.status, 200);
    const body = await response!.json();
    assertEquals(body.length, 2);
    assertEquals(body.includes("electronics"), true);
  });
});

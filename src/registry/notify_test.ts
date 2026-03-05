import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { extractCategories, notifyRegistry } from "./notify.ts";

describe("notifyRegistry", () => {
  it("should POST correct JSON payload to registry URL", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const mockFetch = (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedUrl = input.toString();
      capturedBody = init?.body as string;
      return Promise.resolve(new Response("ok", { status: 200 }));
    };

    await notifyRegistry("https://registry.example.com/register", {
      domain: "shop.example.com",
      merchantName: "Example Shop",
      productCount: 5,
      categories: ["clothing", "accessories"],
    }, { fetchFn: mockFetch });

    assertEquals(capturedUrl, "https://registry.example.com/register");
    const parsed = JSON.parse(capturedBody);
    assertEquals(parsed.domain, "shop.example.com");
    assertEquals(parsed.productCount, 5);
    assertEquals(parsed.categories, ["clothing", "accessories"]);
  });

  it("should not throw when fetch rejects", async () => {
    const mockFetch = (): Promise<Response> => {
      return Promise.reject(new Error("network error"));
    };
    await notifyRegistry("https://registry.example.com/register", {
      domain: "shop.example.com",
      merchantName: "Test",
      productCount: 0,
      categories: [],
    }, { fetchFn: mockFetch });
  });

  it("should not throw when registry returns 500", async () => {
    const mockFetch = (): Promise<Response> => {
      return Promise.resolve(new Response("error", { status: 500 }));
    };
    await notifyRegistry("https://registry.example.com/register", {
      domain: "shop.example.com",
      merchantName: "Test",
      productCount: 0,
      categories: [],
    }, { fetchFn: mockFetch });
  });

  it("should reject non-http URLs", async () => {
    let fetchCalled = false;
    const mockFetch = (): Promise<Response> => {
      fetchCalled = true;
      return Promise.resolve(new Response("ok"));
    };
    await notifyRegistry("ftp://evil.com/register", {
      domain: "shop.example.com",
      merchantName: "Test",
      productCount: 0,
      categories: [],
    }, { fetchFn: mockFetch });
    assertEquals(fetchCalled, false);
  });
});

describe("extractCategories", () => {
  it("should extract category values from product data", () => {
    const products = [
      { category: "Shoes", type: "Running" },
      { category: "Clothing", department: "Men" },
    ];
    const categories = extractCategories(products);
    assertEquals(categories.includes("Shoes"), true);
    assertEquals(categories.includes("Clothing"), true);
    assertEquals(categories.includes("Running"), true);
    assertEquals(categories.includes("Men"), true);
  });

  it("should return empty array for products without category fields", () => {
    const products = [{ name: "Widget", price: 10 }];
    assertEquals(extractCategories(products).length, 0);
  });

  it("should deduplicate categories", () => {
    const products = [
      { category: "Shoes" },
      { category: "Shoes" },
    ];
    assertEquals(extractCategories(products).length, 1);
  });
});

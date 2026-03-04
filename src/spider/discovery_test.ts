import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { buildProductGlobs, isProductUrl } from "./discovery.ts";

describe("Spider - URL Discovery", () => {
  describe("buildProductGlobs", () => {
    it("should generate product URL glob patterns for a given domain", () => {
      const globs = buildProductGlobs("https://shop.example.com");
      assertEquals(globs.length > 0, true);
      // Should include common e-commerce product URL patterns
      assertEquals(globs.some((g) => g.includes("product")), true);
      assertEquals(globs.some((g) => g.includes("item")), true);
    });
  });

  describe("isProductUrl", () => {
    it("should match product-like URLs", () => {
      assertEquals(isProductUrl("https://shop.example.com/product/blue-shirt", "https://shop.example.com"), true);
      assertEquals(isProductUrl("https://shop.example.com/products/widget-123", "https://shop.example.com"), true);
      assertEquals(isProductUrl("https://shop.example.com/items/gadget", "https://shop.example.com"), true);
      assertEquals(isProductUrl("https://shop.example.com/p/12345", "https://shop.example.com"), true);
      assertEquals(isProductUrl("https://shop.example.com/collections/summer/blue-shirt", "https://shop.example.com"), true);
    });

    it("should reject non-product URLs", () => {
      assertEquals(isProductUrl("https://shop.example.com/about", "https://shop.example.com"), false);
      assertEquals(isProductUrl("https://shop.example.com/contact", "https://shop.example.com"), false);
      assertEquals(isProductUrl("https://shop.example.com/cart", "https://shop.example.com"), false);
      assertEquals(isProductUrl("https://shop.example.com/login", "https://shop.example.com"), false);
    });

    it("should reject cross-domain URLs", () => {
      assertEquals(isProductUrl("https://other.com/product/1", "https://shop.example.com"), false);
    });

    it("should handle malformed URLs gracefully", () => {
      assertEquals(isProductUrl("not-a-url", "https://shop.example.com"), false);
      assertEquals(isProductUrl("", "https://shop.example.com"), false);
      assertEquals(isProductUrl("javascript:void(0)", "https://shop.example.com"), false);
    });
  });
});

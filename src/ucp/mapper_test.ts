import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { mapProductToGoogleMerchant } from "./mapper.ts";
import type { Product } from "../storage/db.ts";

function makeProduct(
  data: Record<string, unknown>,
  overrides?: Partial<Product>,
): Product {
  return {
    id: 1,
    merchantId: 1,
    sourceUrl: "https://shop.com/p/1",
    data,
    schema: {},
    createdAt: "2026-03-06",
    ...overrides,
  };
}

describe("Google Merchant Mapper", () => {
  it("should map product with standard field names", () => {
    const product = makeProduct({
      name: "Blue Shirt",
      description: "A nice blue shirt",
      price: 29.99,
      currency: "USD",
      image: "https://shop.com/img/1.jpg",
      availability: "in_stock",
    });
    const result = mapProductToGoogleMerchant(product);
    assertEquals(result.offerId, "1");
    assertEquals(result.link, "https://shop.com/p/1");
    assertEquals(result.productAttributes.title, "Blue Shirt");
    assertEquals(result.productAttributes.description, "A nice blue shirt");
    assertEquals(
      result.productAttributes.imageLink,
      "https://shop.com/img/1.jpg",
    );
    assertEquals(result.productAttributes.availability, "in_stock");
    assertEquals(result.productAttributes.price, {
      value: "29.99",
      currency: "USD",
    });
  });

  it("should handle alternate field names (title, imageUrl, product_name)", () => {
    const r1 = mapProductToGoogleMerchant(makeProduct({ title: "Widget" }));
    assertEquals(r1.productAttributes.title, "Widget");

    const r2 = mapProductToGoogleMerchant(
      makeProduct({ product_name: "Gadget" }),
    );
    assertEquals(r2.productAttributes.title, "Gadget");

    const r3 = mapProductToGoogleMerchant(
      makeProduct({ imageUrl: "https://img.com/x.jpg" }),
    );
    assertEquals(r3.productAttributes.imageLink, "https://img.com/x.jpg");
  });

  it("should handle images array", () => {
    const result = mapProductToGoogleMerchant(
      makeProduct({
        images: ["https://img.com/1.jpg", "https://img.com/2.jpg"],
      }),
    );
    assertEquals(result.productAttributes.imageLink, "https://img.com/1.jpg");
  });

  it("should handle missing optional fields gracefully", () => {
    const result = mapProductToGoogleMerchant(makeProduct({}));
    assertEquals(result.offerId, "1");
    assertEquals(result.link, "https://shop.com/p/1");
    assertEquals(result.productAttributes.title, "");
    assertEquals(result.productAttributes.description, "");
    assertEquals(result.productAttributes.imageLink, undefined);
    assertEquals(result.productAttributes.availability, "out_of_stock");
    assertEquals(result.productAttributes.price, {
      value: "0",
      currency: "USD",
    });
  });

  it("should normalize string prices with currency symbols", () => {
    const r1 = mapProductToGoogleMerchant(makeProduct({ price: "$29.99" }));
    assertEquals(r1.productAttributes.price.value, "29.99");

    const r2 = mapProductToGoogleMerchant(makeProduct({ price: "€49.00" }));
    assertEquals(r2.productAttributes.price.value, "49.00");
  });

  it("should normalize boolean availability", () => {
    const r1 = mapProductToGoogleMerchant(
      makeProduct({ in_stock: true }),
    );
    assertEquals(r1.productAttributes.availability, "in_stock");

    const r2 = mapProductToGoogleMerchant(
      makeProduct({ in_stock: false }),
    );
    assertEquals(r2.productAttributes.availability, "out_of_stock");
  });

  it("should handle null and undefined data values", () => {
    const result = mapProductToGoogleMerchant(
      makeProduct({ name: null, price: undefined, image: null }),
    );
    assertEquals(result.productAttributes.title, "");
    assertEquals(result.productAttributes.price.value, "0");
    assertEquals(result.productAttributes.imageLink, undefined);
  });

  it("should put unmapped fields into additionalAttributes", () => {
    const result = mapProductToGoogleMerchant(
      makeProduct({ name: "X", brand: "Nike", size: "L", color: "Red" }),
    );
    assertEquals(result.productAttributes.additionalAttributes?.brand, "Nike");
    assertEquals(result.productAttributes.additionalAttributes?.size, "L");
    assertEquals(result.productAttributes.additionalAttributes?.color, "Red");
  });

  it("should use product id as string for offerId", () => {
    const result = mapProductToGoogleMerchant(
      makeProduct({}, { id: 42 }),
    );
    assertEquals(result.offerId, "42");
  });
});

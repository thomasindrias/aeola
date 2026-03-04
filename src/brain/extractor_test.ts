import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { extractProductData } from "./extractor.ts";

// Minimal mock matching the OpenAI client contract
function createMockOpenAI(mockResponse: string) {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: mockResponse } }],
        }),
      },
    },
  };
}

// Compact accessibility tree snapshot (from agent-browser)
const SAMPLE_SNAPSHOT = `@e1 [heading] "Blue Cotton T-Shirt" [level=1]
@e2 [text] "Price: $29.99"
@e3 [text] "Available sizes: S, M, L, XL"
@e4 [text] "Material: 100% Organic Cotton"
@e5 [text] "Color: Ocean Blue"
@e6 [text] "In stock - ships within 2 days"
@e7 [button] "Add to Cart"`;

const VALID_EXTRACTION = JSON.stringify({
  schema: {
    type: "product",
    properties: {
      name: "string",
      price: "number",
      currency: "string",
      sizes: "array",
      material: "string",
      color: "string",
      availability: "string",
    },
  },
  data: {
    name: "Blue Cotton T-Shirt",
    price: 29.99,
    currency: "USD",
    sizes: ["S", "M", "L", "XL"],
    material: "100% Organic Cotton",
    color: "Ocean Blue",
    availability: "In stock - ships within 2 days",
  },
});

describe("Brain - Dynamic Extractor", () => {
  it("should return parsed schema and data from valid LLM response", async () => {
    const mockClient = createMockOpenAI(VALID_EXTRACTION);
    const result = await extractProductData(mockClient as any, SAMPLE_SNAPSHOT);

    assertExists(result.schema);
    assertExists(result.data);
    assertEquals(result.data.name, "Blue Cotton T-Shirt");
    assertEquals(result.data.price, 29.99);
    assertEquals(result.schema.type, "product");
  });

  it("should throw on malformed JSON from LLM", async () => {
    const mockClient = createMockOpenAI("not valid json at all");
    await assertRejects(
      () => extractProductData(mockClient as any, SAMPLE_SNAPSHOT),
      Error,
      "Failed to parse",
    );
  });

  it("should throw when LLM returns JSON without required fields", async () => {
    const mockClient = createMockOpenAI(JSON.stringify({ foo: "bar" }));
    await assertRejects(
      () => extractProductData(mockClient as any, SAMPLE_SNAPSHOT),
      Error,
      "Failed to parse",
    );
  });

  it("should throw on empty LLM response", async () => {
    const mockClient = {
      chat: { completions: { create: async () => ({ choices: [{ message: { content: null } }] }) } },
    };
    await assertRejects(
      () => extractProductData(mockClient as any, SAMPLE_SNAPSHOT),
      Error,
      "Failed to parse",
    );
  });
});

import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import type OpenAI from "@openai/openai";
import { extractProductData } from "./extractor.ts";

// Minimal mock matching the OpenAI client contract
function createMockOpenAI(mockResponse: string | null): OpenAI {
  return {
    chat: {
      completions: {
        create: () =>
          Promise.resolve({
            choices: [{ message: { content: mockResponse } }],
          }),
      },
    },
  } as unknown as OpenAI;
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
    const result = await extractProductData(mockClient, SAMPLE_SNAPSHOT);

    assertExists(result.schema);
    assertExists(result.data);
    assertEquals(result.data.name, "Blue Cotton T-Shirt");
    assertEquals(result.data.price, 29.99);
    assertEquals(result.schema.type, "product");
  });

  it("should throw on malformed JSON from LLM", async () => {
    const mockClient = createMockOpenAI("not valid json at all");
    await assertRejects(
      () => extractProductData(mockClient, SAMPLE_SNAPSHOT),
      SyntaxError,
    );
  });

  it("should throw when LLM returns JSON without required fields", async () => {
    const mockClient = createMockOpenAI(JSON.stringify({ foo: "bar" }));
    await assertRejects(
      () => extractProductData(mockClient, SAMPLE_SNAPSHOT),
      Error,
      "Missing required fields",
    );
  });

  it("should throw on empty LLM response", async () => {
    const mockClient = createMockOpenAI(null);
    await assertRejects(
      () => extractProductData(mockClient, SAMPLE_SNAPSHOT),
      Error,
      "Empty response from LLM",
    );
  });

  describe("URL context", () => {
    it("should include source URL in user message when provided", async () => {
      let capturedMessages: Array<{ role: string; content: string }> = [];
      const mockClient = {
        chat: {
          completions: {
            create: (
              params: { messages: Array<{ role: string; content: string }> },
            ) => {
              capturedMessages = params.messages;
              return Promise.resolve({
                choices: [{ message: { content: VALID_EXTRACTION } }],
              });
            },
          },
        },
      } as unknown as OpenAI;

      await extractProductData(
        mockClient,
        SAMPLE_SNAPSHOT,
        "https://example.com/catalogue/its-only-the-himalayas_54/index.html",
      );

      const userMsg = capturedMessages.find((m) => m.role === "user")!;
      assertEquals(userMsg.content.includes("Source URL:"), true);
      assertEquals(userMsg.content.includes("its-only-the-himalayas"), true);
      assertEquals(userMsg.content.includes(SAMPLE_SNAPSHOT), true);
    });

    it("should send only snapshot when no URL provided", async () => {
      let capturedMessages: Array<{ role: string; content: string }> = [];
      const mockClient = {
        chat: {
          completions: {
            create: (
              params: { messages: Array<{ role: string; content: string }> },
            ) => {
              capturedMessages = params.messages;
              return Promise.resolve({
                choices: [{ message: { content: VALID_EXTRACTION } }],
              });
            },
          },
        },
      } as unknown as OpenAI;

      await extractProductData(mockClient, SAMPLE_SNAPSHOT);

      const userMsg = capturedMessages.find((m) => m.role === "user")!;
      assertEquals(userMsg.content.includes("Source URL:"), false);
      assertEquals(userMsg.content, SAMPLE_SNAPSHOT);
    });
  });

  it("should pass response_format json_object to OpenAI", async () => {
    let capturedParams: Record<string, unknown> = {};
    const mockClient = {
      chat: {
        completions: {
          create: (params: Record<string, unknown>) => {
            capturedParams = params;
            return Promise.resolve({
              choices: [{ message: { content: VALID_EXTRACTION } }],
            });
          },
        },
      },
    } as unknown as OpenAI;

    await extractProductData(mockClient, SAMPLE_SNAPSHOT);
    assertEquals(
      (capturedParams.response_format as { type: string }).type,
      "json_object",
    );
  });
});

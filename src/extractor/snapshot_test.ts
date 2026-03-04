import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { getPageSnapshot, parseSnapshotText } from "./snapshot.ts";

// Sample agent-browser snapshot output (compact accessibility tree format)
const SAMPLE_SNAPSHOT = `@e1 [heading] "Blue Cotton T-Shirt" [level=1]
@e2 [text] "Price: $29.99"
@e3 [text] "Available sizes: S, M, L, XL"
@e4 [text] "Material: 100% Organic Cotton"
@e5 [text] "Color: Ocean Blue"
@e6 [text] "In stock - ships within 2 days"
@e7 [button] "Add to Cart"
@e8 [link] "Back to products"`;

describe("Extractor - Agent Browser Snapshots", () => {
  describe("parseSnapshotText", () => {
    it("should return the raw snapshot text for LLM processing", () => {
      const result = parseSnapshotText(SAMPLE_SNAPSHOT);
      assertExists(result);
      assertEquals(result.includes("Blue Cotton T-Shirt"), true);
      assertEquals(result.includes("29.99"), true);
      assertEquals(result.includes("Organic Cotton"), true);
    });

    it("should handle empty snapshot gracefully", () => {
      const result = parseSnapshotText("");
      assertEquals(result, "");
    });
  });

  describe("getPageSnapshot", () => {
    it("should call agent-browser CLI and return snapshot text", async () => {
      const mockExecutor = async (_url: string): Promise<string> => {
        return SAMPLE_SNAPSHOT;
      };

      const result = await getPageSnapshot("https://example.com/product/1", mockExecutor);
      assertExists(result);
      assertEquals(result.includes("Blue Cotton T-Shirt"), true);
    });

    it("should throw on CLI failure", async () => {
      const mockExecutor = async (_url: string): Promise<string> => {
        throw new Error("agent-browser: command not found");
      };

      await assertRejects(
        () => getPageSnapshot("https://example.com/product/1", mockExecutor),
        Error,
        "agent-browser",
      );
    });
  });
});

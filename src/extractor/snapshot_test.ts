import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { CONTENT_SELECTORS, getPageSnapshot, parseSnapshotText, tryScopedSnapshot } from "./snapshot.ts";

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

  describe("tryScopedSnapshot", () => {
    it("should return snapshot when selector matches content over 50 chars", async () => {
      const longContent = `@e1 [heading] "Product Name Here" [level=1]\n@e2 [text] "Price: $29.99"`;
      const mockCmd = async (_args: string[]) => ({
        success: true,
        stdout: longContent,
      });
      const result = await tryScopedSnapshot("main", mockCmd);
      assertExists(result);
      assertEquals(result!.includes("Product Name"), true);
    });

    it("should return null when selector returns content under 50 chars", async () => {
      const mockCmd = async (_args: string[]) => ({
        success: true,
        stdout: "short output",
      });
      const result = await tryScopedSnapshot("main", mockCmd);
      assertEquals(result, null);
    });

    it("should return null when command fails", async () => {
      const mockCmd = async (_args: string[]) => ({
        success: false,
        stdout: "",
      });
      const result = await tryScopedSnapshot(".nonexistent", mockCmd);
      assertEquals(result, null);
    });

    it("should return null when command throws", async () => {
      const mockCmd = async (_args: string[]) => {
        throw new Error("command not found");
      };
      const result = await tryScopedSnapshot("main", mockCmd);
      assertEquals(result, null);
    });

    it("should pass correct args including selector", async () => {
      let capturedArgs: string[] = [];
      const mockCmd = async (args: string[]) => {
        capturedArgs = args;
        return { success: true, stdout: "x".repeat(60) };
      };
      await tryScopedSnapshot("#my-selector", mockCmd);
      assertEquals(capturedArgs.includes("-s"), true);
      assertEquals(capturedArgs.includes("#my-selector"), true);
      assertEquals(capturedArgs.includes("-i"), true);
      assertEquals(capturedArgs.includes("-c"), true);
    });
  });

  describe("CONTENT_SELECTORS", () => {
    it("should be a non-empty array of CSS selectors", () => {
      assertEquals(CONTENT_SELECTORS.length > 0, true);
      assertEquals(CONTENT_SELECTORS.includes("main"), true);
    });
  });

  describe("getPageSnapshot", () => {
    it("should call agent-browser CLI and return snapshot text", async () => {
      const mockExecutor = (_url: string): Promise<string> => {
        return Promise.resolve(SAMPLE_SNAPSHOT);
      };

      const result = await getPageSnapshot("https://example.com/product/1", mockExecutor);
      assertExists(result);
      assertEquals(result.includes("Blue Cotton T-Shirt"), true);
    });

    it("should throw on CLI failure", async () => {
      const mockExecutor = (_url: string): Promise<string> => {
        return Promise.reject(new Error("agent-browser: command not found"));
      };

      await assertRejects(
        () => getPageSnapshot("https://example.com/product/1", mockExecutor),
        Error,
        "agent-browser",
      );
    });
  });
});

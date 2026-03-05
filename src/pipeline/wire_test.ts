import { afterEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists } from "@std/assert";
import { buildIngestOptions } from "./wire.ts";

describe("buildIngestOptions", () => {
  afterEach(() => {
    Deno.env.delete("OPENAI_API_KEY");
    Deno.env.delete("REGISTRY_ENABLED");
    Deno.env.delete("REGISTRY_URL");
  });

  it("should return IngestOptions with all required fields", () => {
    Deno.env.set("OPENAI_API_KEY", "test-key");
    const opts = buildIngestOptions("https://shop.example.com", "Test Shop");
    assertEquals(opts.url, "https://shop.example.com");
    assertEquals(opts.name, "Test Shop");
    assertExists(opts.discover);
    assertExists(opts.extractSnapshot);
    assertExists(opts.processWithLLM);
    assertExists(opts.openaiClient);
    assertEquals(typeof opts.concurrency, "number");
  });

  it("should include registry fields from env vars", () => {
    Deno.env.set("OPENAI_API_KEY", "test-key");
    Deno.env.set("REGISTRY_ENABLED", "true");
    Deno.env.set("REGISTRY_URL", "https://registry.example.com");
    const opts = buildIngestOptions("https://shop.example.com", "Test");
    assertEquals(opts.registryEnabled, true);
    assertEquals(opts.registryUrl, "https://registry.example.com");
  });
});

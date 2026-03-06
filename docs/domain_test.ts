import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";

describe("docs/domain.md", () => {
  it("should exist and contain expected sections", async () => {
    const content = await Deno.readTextFile("docs/domain.md");
    const requiredSections = [
      "## AEO",
      "## ACP",
      "## MCP",
      "## UCP",
      "## Glossary",
    ];
    for (const section of requiredSections) {
      assert(content.includes(section), `Missing section: ${section}`);
    }
  });
});

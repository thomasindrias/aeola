import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { getUcpProfile } from "./profile.ts";

describe("UCP Profile", () => {
  it("should return spec-compliant profile with nested ucp object", () => {
    const profile = getUcpProfile();
    assert(profile.ucp, "profile must have ucp top-level key");
    assertEquals(typeof profile.ucp.version, "string");
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(profile.ucp.version),
      "version must be YYYY-MM-DD format",
    );
  });

  it("should declare capabilities with reverse-domain notation", () => {
    const profile = getUcpProfile();
    assert(Array.isArray(profile.ucp.capabilities));
    assert(profile.ucp.capabilities.length > 0);

    const catalog = profile.ucp.capabilities[0];
    assert(
      catalog.name.includes("."),
      "capability name must use reverse-domain notation",
    );
    assertEquals(catalog.name, "io.aeola.product_catalog");
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(catalog.version),
      "capability version must be YYYY-MM-DD format",
    );
    assertEquals(typeof catalog.spec, "string");
    assertEquals(typeof catalog.schema, "string");
  });

  it("should include services with transport endpoints", () => {
    const profile = getUcpProfile();
    assert(profile.ucp.services);
    const service = profile.ucp.services["io.aeola.catalog"];
    assert(service, "must declare io.aeola.catalog service");
    assertEquals(typeof service.version, "string");

    assert(service.rest || service.mcp, "must have at least one transport");
    if (service.rest) assertEquals(typeof service.rest.endpoint, "string");
    if (service.mcp) assertEquals(typeof service.mcp.endpoint, "string");
  });

  it("should not include payment handlers or signing keys", () => {
    const profile = getUcpProfile();
    assertEquals(
      (profile as unknown as Record<string, unknown>).payment,
      undefined,
    );
    assertEquals(
      (profile as unknown as Record<string, unknown>).signing_keys,
      undefined,
    );
  });
});

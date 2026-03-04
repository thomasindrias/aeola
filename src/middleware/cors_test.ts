import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { addCorsHeaders, handlePreflight } from "./cors.ts";

describe("CORS", () => {
  it("should add CORS headers to response", () => {
    const response = new Response("ok");
    const corsResponse = addCorsHeaders(response, "*");
    assertEquals(corsResponse.headers.get("Access-Control-Allow-Origin"), "*");
  });

  it("should return 204 for preflight OPTIONS", () => {
    const response = handlePreflight("*");
    assertEquals(response.status, 204);
    assertEquals(
      response.headers.get("Access-Control-Allow-Methods"),
      "GET, POST, OPTIONS",
    );
  });

  it("should use configured origin", () => {
    const response = addCorsHeaders(new Response("ok"), "https://app.example.com");
    assertEquals(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://app.example.com",
    );
  });
});

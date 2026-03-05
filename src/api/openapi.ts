export function getOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Aeola API",
      version: "1.0.0",
      description:
        "AEO infrastructure — makes e-commerce product data discoverable and consumable by AI agents via REST and MCP.",
      license: {
        name: "AGPL-3.0",
        url: "https://www.gnu.org/licenses/agpl-3.0.html",
      },
    },
    servers: [{ url: "http://localhost:8000" }],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        Merchant: {
          type: "object",
          properties: {
            id: { type: "integer" },
            url: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "integer" },
            merchantId: { type: "integer" },
            sourceUrl: { type: "string" },
            data: { type: "object", additionalProperties: true },
            schema: { type: "object", additionalProperties: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        IngestRequest: {
          type: "object",
          required: ["url", "name"],
          properties: {
            url: { type: "string", example: "https://shop.example.com" },
            name: { type: "string", example: "Example Shop" },
          },
        },
        IngestResult: {
          type: "object",
          properties: {
            merchantId: { type: "integer" },
            productsIngested: { type: "integer" },
            urlsDiscovered: { type: "integer" },
            errors: { type: "array", items: { type: "string" } },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          security: [],
          responses: {
            "200": {
              description: "Service is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { status: { type: "string", example: "ok" } },
                  },
                },
              },
            },
          },
        },
      },
      "/ingest": {
        post: {
          summary: "Ingest a merchant website",
          description:
            "Crawls a merchant URL, extracts product data using LLM, and stores it.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/IngestRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Ingestion result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/IngestResult" },
                },
              },
            },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/merchants": {
        get: {
          summary: "List all merchants",
          responses: {
            "200": {
              description: "Array of merchants",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Merchant" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/merchants/{id}": {
        get: {
          summary: "Get merchant by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              description: "Merchant details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Merchant" },
                },
              },
            },
            "404": { description: "Merchant not found" },
          },
        },
      },
      "/api/merchants/{id}/products": {
        get: {
          summary: "List products by merchant",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 20 },
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", default: 0 },
            },
          ],
          responses: {
            "200": {
              description: "Array of products",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/products/search": {
        get: {
          summary: "Search products",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 20 },
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", default: 0 },
            },
          ],
          responses: {
            "200": {
              description: "Array of matching products",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/products/{id}": {
        get: {
          summary: "Get product by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              description: "Product details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Product" },
                },
              },
            },
            "404": { description: "Product not found" },
          },
        },
      },
      "/mcp": {
        post: {
          summary: "MCP endpoint",
          description:
            "Model Context Protocol endpoint for AI agent integration.",
          responses: {
            "200": { description: "MCP response" },
          },
        },
      },
    },
  };
}

import { afterEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./server.ts";
import {
  addMerchant,
  addProduct,
  addProductCategories,
  createDatabase,
  createIngestionJob,
  updateJobStatus,
} from "../storage/db.ts";

async function createTestClient(
  db: ReturnType<typeof createDatabase>,
  options?: Parameters<typeof createMcpServer>[1],
) {
  const server = createMcpServer(db, options);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe("MCP Server", () => {
  let db: ReturnType<typeof createDatabase>;

  afterEach(() => {
    db?.close();
  });

  it("should create an MCP server instance", () => {
    db = createDatabase(":memory:");
    const server = createMcpServer(db);
    assertExists(server);
  });

  it("should list tools via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    assertEquals(toolNames.includes("list_products"), true);
    assertEquals(toolNames.includes("search_products"), true);
    assertEquals(toolNames.includes("get_product"), true);
    await client.close();
  });

  it("should call list_products tool via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const merchantId = addMerchant(db, {
      url: "https://example.com",
      name: "Test",
    });
    addProduct(db, {
      merchantId,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Widget", price: 9.99 },
      schema: { type: "product" },
    });
    const client = await createTestClient(db);
    const result = await client.callTool({
      name: "list_products",
      arguments: { merchantId },
    });
    const products = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(products.length, 1);
    assertEquals(products[0].data.name, "Widget");
    assertEquals(products[0].data.price, 9.99);
    await client.close();
  });

  it("should call search_products tool via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const merchantId = addMerchant(db, {
      url: "https://example.com",
      name: "Test",
    });
    addProduct(db, {
      merchantId,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Blue Widget" },
      schema: { type: "product" },
    });
    addProduct(db, {
      merchantId,
      sourceUrl: "https://example.com/p/2",
      data: { name: "Red Gadget" },
      schema: { type: "product" },
    });
    const client = await createTestClient(db);
    const result = await client.callTool({
      name: "search_products",
      arguments: { query: "blue" },
    });
    const products = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(products.length, 1);
    assertEquals(products[0].data.name, "Blue Widget");
    await client.close();
  });

  it("should call get_product tool via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const merchantId = addMerchant(db, {
      url: "https://example.com",
      name: "Test",
    });
    const productId = addProduct(db, {
      merchantId,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Widget" },
      schema: { type: "product" },
    });
    const client = await createTestClient(db);
    const result = await client.callTool({
      name: "get_product",
      arguments: { productId },
    });
    const product = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(product.data.name, "Widget");
    await client.close();
  });

  it("should list ingest_merchant tool via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    assertEquals(toolNames.includes("ingest_merchant"), true);
    await client.close();
  });

  it("should call ingest_merchant tool with injected function", async () => {
    db = createDatabase(":memory:");
    let calledWith: { url: string; name: string } | null = null;
    const client = await createTestClient(db, {
      ingestFn: (_db, url, name) => {
        calledWith = { url, name };
        return Promise.resolve({
          jobId: 1,
          merchantId: 1,
          productsIngested: 0,
          urlsDiscovered: 0,
          errors: [],
        });
      },
    });
    const result = await client.callTool({
      name: "ingest_merchant",
      arguments: { url: "https://shop.example.com", name: "Test Shop" },
    });
    const body = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(calledWith, {
      url: "https://shop.example.com",
      name: "Test Shop",
    });
    assertEquals(body.merchantId, 1);
    await client.close();
  });

  it("should reject non-http URL in ingest_merchant tool", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db, {
      ingestFn: () => {
        throw new Error("should not be called");
      },
    });
    const result = await client.callTool({
      name: "ingest_merchant",
      arguments: { url: "file:///etc/passwd", name: "Evil" },
    });
    assertEquals(result.isError, true);
    const body = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(body.error, "Only http/https URLs are supported");
    await client.close();
  });

  it("should include Aeola branding in tool descriptions", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert(
        tool.description?.includes("Aeola"),
        `Tool ${tool.name} should mention Aeola in its description`,
      );
    }
    await client.close();
  });

  it("should return error for non-existent product via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const result = await client.callTool({
      name: "get_product",
      arguments: { productId: 999 },
    });
    const body = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(body.error, "Product not found");
    await client.close();
  });

  it("should list get_ingestion_status in tools", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    assertEquals(toolNames.includes("get_ingestion_status"), true);
    await client.close();
  });

  it("should return job data for existing job", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, {
      url: "https://example.com",
      name: "Test",
    });
    const jobId = createIngestionJob(db, mid);
    updateJobStatus(db, jobId, "completed", { productsExtracted: 3 });
    const client = await createTestClient(db);
    const result = await client.callTool({
      name: "get_ingestion_status",
      arguments: { jobId },
    });
    const job = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(job.status, "completed");
    assertEquals(job.productsExtracted, 3);
    await client.close();
  });

  it("should return error for non-existent job", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const result = await client.callTool({
      name: "get_ingestion_status",
      arguments: { jobId: 999 },
    });
    const body = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(body.error, "Job not found");
    await client.close();
  });

  it("should filter search_products by category", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, {
      url: "https://example.com",
      name: "Test",
    });
    const p1 = addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Blue Widget" },
      schema: { type: "product" },
    });
    const p2 = addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://example.com/p/2",
      data: { name: "Blue Shirt" },
      schema: { type: "product" },
    });
    addProductCategories(db, p1, ["electronics"]);
    addProductCategories(db, p2, ["clothing"]);
    const client = await createTestClient(db);
    const result = await client.callTool({
      name: "search_products",
      arguments: { query: "Blue", category: "electronics" },
    });
    const products = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    assertEquals(products.length, 1);
    assertEquals(products[0].data.name, "Blue Widget");
    await client.close();
  });

  it("should list resources including catalog://merchants", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    assert(uris.includes("catalog://merchants"));
    await client.close();
  });

  it("should read catalog://merchants resource with merchant data", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, {
      url: "https://example.com",
      name: "Test",
    });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Widget" },
      schema: {},
    });
    const client = await createTestClient(db);
    const { contents } = await client.readResource({
      uri: "catalog://merchants",
    });
    const data = JSON.parse(
      (contents[0] as { text: string }).text,
    );
    assertEquals(data.length, 1);
    assertEquals(data[0].name, "Test");
    assertEquals(data[0].productCount, 1);
    await client.close();
  });

  it("should read catalog://merchants/{id} resource with detail", async () => {
    db = createDatabase(":memory:");
    const mid = addMerchant(db, {
      url: "https://example.com",
      name: "Test",
    });
    addProduct(db, {
      merchantId: mid,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Widget" },
      schema: {},
    });
    const client = await createTestClient(db);
    const { contents } = await client.readResource({
      uri: `catalog://merchants/${mid}`,
    });
    const data = JSON.parse(
      (contents[0] as { text: string }).text,
    );
    assertEquals(data.name, "Test");
    assert(Array.isArray(data.products));
    assert(Array.isArray(data.categories));
    await client.close();
  });
});

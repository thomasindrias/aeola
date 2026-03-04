import { describe, it, afterEach } from "@std/testing/bdd";
import { assertExists, assertEquals } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./server.ts";
import { createDatabase, addMerchant, addProduct } from "../storage/db.ts";

async function createTestClient(db: ReturnType<typeof createDatabase>) {
  const server = createMcpServer(db);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
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
    const merchantId = addMerchant(db, { url: "https://example.com", name: "Test" });
    addProduct(db, {
      merchantId,
      sourceUrl: "https://example.com/p/1",
      data: { name: "Widget", price: 9.99 },
      schema: { type: "product" },
    });
    const client = await createTestClient(db);
    const result = await client.callTool({ name: "list_products", arguments: { merchantId } });
    const products = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    assertEquals(products.length, 1);
    assertEquals(products[0].data.name, "Widget");
    assertEquals(products[0].data.price, 9.99);
    await client.close();
  });

  it("should call search_products tool via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const merchantId = addMerchant(db, { url: "https://example.com", name: "Test" });
    addProduct(db, { merchantId, sourceUrl: "https://example.com/p/1", data: { name: "Blue Widget" }, schema: { type: "product" } });
    addProduct(db, { merchantId, sourceUrl: "https://example.com/p/2", data: { name: "Red Gadget" }, schema: { type: "product" } });
    const client = await createTestClient(db);
    const result = await client.callTool({ name: "search_products", arguments: { query: "blue" } });
    const products = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    assertEquals(products.length, 1);
    assertEquals(products[0].data.name, "Blue Widget");
    await client.close();
  });

  it("should call get_product tool via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const merchantId = addMerchant(db, { url: "https://example.com", name: "Test" });
    const productId = addProduct(db, { merchantId, sourceUrl: "https://example.com/p/1", data: { name: "Widget" }, schema: { type: "product" } });
    const client = await createTestClient(db);
    const result = await client.callTool({ name: "get_product", arguments: { productId } });
    const product = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    assertEquals(product.data.name, "Widget");
    await client.close();
  });

  it("should return error for non-existent product via MCP protocol", async () => {
    db = createDatabase(":memory:");
    const client = await createTestClient(db);
    const result = await client.callTool({ name: "get_product", arguments: { productId: 999 } });
    const body = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    assertEquals(body.error, "Product not found");
    await client.close();
  });
});

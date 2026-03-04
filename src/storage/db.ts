import { Database } from "@db/sqlite";

export interface MerchantInput {
  url: string;
  name: string;
}

export interface Merchant {
  id: number;
  url: string;
  name: string;
  createdAt: string;
}

export interface ProductInput {
  merchantId: number;
  sourceUrl: string;
  data: Record<string, unknown>;
  schema: Record<string, unknown>;
}

export interface Product {
  id: number;
  merchantId: number;
  sourceUrl: string;
  data: Record<string, unknown>;
  schema: Record<string, unknown>;
  createdAt: string;
}

export function createDatabase(path: string): Database {
  const db = new Database(path);
  db.exec("pragma journal_mode = WAL");
  db.exec("pragma foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL REFERENCES merchants(id),
      source_url TEXT NOT NULL,
      data TEXT NOT NULL,
      schema_def TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(merchant_id, source_url)
    )
  `);

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id)",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_products_source_url ON products(source_url)",
  );

  return db;
}

export function addMerchant(db: Database, input: MerchantInput): number {
  db.prepare("INSERT INTO merchants (url, name) VALUES (?, ?)").run(
    input.url,
    input.name,
  );
  return db.prepare("SELECT last_insert_rowid() as id").value<[number]>()![0];
}

export function getOrCreateMerchant(
  db: Database,
  input: MerchantInput,
): number {
  const existing = db.prepare("SELECT id FROM merchants WHERE url = ?").get<
    { id: number }
  >(input.url);
  if (existing) return existing.id;
  return addMerchant(db, input);
}

export function listMerchants(db: Database): Merchant[] {
  return db.prepare(
    "SELECT id, url, name, created_at as createdAt FROM merchants",
  ).all<Merchant>();
}

export function getMerchant(db: Database, id: number): Merchant | undefined {
  return db.prepare(
    "SELECT id, url, name, created_at as createdAt FROM merchants WHERE id = ?",
  ).get<Merchant>(id);
}

export function addProduct(db: Database, input: ProductInput): number {
  db.prepare(
    `INSERT INTO products (merchant_id, source_url, data, schema_def) VALUES (?, ?, ?, ?)
     ON CONFLICT(merchant_id, source_url) DO UPDATE SET
       data = excluded.data,
       schema_def = excluded.schema_def`,
  ).run(
    input.merchantId,
    input.sourceUrl,
    JSON.stringify(input.data),
    JSON.stringify(input.schema),
  );
  return db.prepare("SELECT last_insert_rowid() as id").value<[number]>()![0];
}

function deserializeProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    merchantId: row.merchantId as number,
    sourceUrl: row.sourceUrl as string,
    data: typeof row.data === "string"
      ? JSON.parse(row.data)
      : row.data as Record<string, unknown>,
    schema: typeof row.schema_def === "string"
      ? JSON.parse(row.schema_def)
      : row.schema_def as Record<string, unknown>,
    createdAt: row.createdAt as string,
  };
}

export function getProduct(db: Database, id: number): Product | undefined {
  const row = db.prepare(
    "SELECT id, merchant_id as merchantId, source_url as sourceUrl, data, schema_def, created_at as createdAt FROM products WHERE id = ?",
  ).get<Record<string, unknown>>(id);
  return row ? deserializeProduct(row) : undefined;
}

export function getProductsByMerchant(
  db: Database,
  merchantId: number,
  limit = 100,
  offset = 0,
): Product[] {
  const rows = db.prepare(
    "SELECT id, merchant_id as merchantId, source_url as sourceUrl, data, schema_def, created_at as createdAt FROM products WHERE merchant_id = ? LIMIT ? OFFSET ?",
  ).all<Record<string, unknown>>(merchantId, limit, offset);
  return rows.map(deserializeProduct);
}

export function searchProducts(
  db: Database,
  query: string,
  limit = 100,
  offset = 0,
): Product[] {
  if (query.length > 500) {
    throw new Error("Search query too long (max 500 characters)");
  }
  const rows = db.prepare(
    "SELECT id, merchant_id as merchantId, source_url as sourceUrl, data, schema_def, created_at as createdAt FROM products WHERE data LIKE ? LIMIT ? OFFSET ?",
  ).all<Record<string, unknown>>(`%${query}%`, limit, offset);
  return rows.map(deserializeProduct);
}

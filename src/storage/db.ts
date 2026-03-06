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

export type JobStatus = "pending" | "in_progress" | "completed" | "failed";

export interface IngestionJob {
  id: number;
  merchantId: number;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
  urlsDiscovered: number;
  productsExtracted: number;
  productsFailed: number;
  createdAt: string;
}

export interface ExtractionError {
  id: number;
  jobId: number;
  sourceUrl: string;
  errorMessage: string;
  createdAt: string;
}

export interface IngestionJobDetail extends IngestionJob {
  errors: ExtractionError[];
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS ingestion_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL REFERENCES merchants(id),
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TEXT,
      completed_at TEXT,
      urls_discovered INTEGER NOT NULL DEFAULT 0,
      products_extracted INTEGER NOT NULL DEFAULT 0,
      products_failed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_jobs_merchant ON ingestion_jobs(merchant_id)",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_jobs_status ON ingestion_jobs(status)",
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS extraction_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES ingestion_jobs(id),
      source_url TEXT NOT NULL,
      error_message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_errors_job ON extraction_errors(job_id)",
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      category TEXT NOT NULL,
      UNIQUE(product_id, category)
    )
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_categories_cat ON product_categories(category)",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_categories_product ON product_categories(product_id)",
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
  category?: string,
  merchantId?: number,
): Product[] {
  if (query.length > 500) {
    throw new Error("Search query too long (max 500 characters)");
  }
  const escaped = query.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const conditions = ["p.data LIKE ? ESCAPE '\\'"];
  const params: (string | number)[] = [`%${escaped}%`];
  if (category) {
    conditions.push("pc.category = ?");
    params.push(category);
  }
  if (merchantId !== undefined) {
    conditions.push("p.merchant_id = ?");
    params.push(merchantId);
  }
  params.push(limit, offset);
  const where = conditions.join(" AND ");
  const join = category
    ? " JOIN product_categories pc ON pc.product_id = p.id"
    : "";
  const rows = db.prepare(
    `SELECT p.id, p.merchant_id as merchantId, p.source_url as sourceUrl, p.data, p.schema_def, p.created_at as createdAt FROM products p${join} WHERE ${where} LIMIT ? OFFSET ?`,
  ).all<Record<string, unknown>>(...params);
  return rows.map(deserializeProduct);
}

// --- Ingestion Jobs ---

function deserializeJob(row: Record<string, unknown>): IngestionJob {
  return {
    id: row.id as number,
    merchantId: row.merchantId as number,
    status: row.status as JobStatus,
    startedAt: (row.startedAt as string) ?? null,
    completedAt: (row.completedAt as string) ?? null,
    urlsDiscovered: row.urlsDiscovered as number,
    productsExtracted: row.productsExtracted as number,
    productsFailed: row.productsFailed as number,
    createdAt: row.createdAt as string,
  };
}

function deserializeError(row: Record<string, unknown>): ExtractionError {
  return {
    id: row.id as number,
    jobId: row.jobId as number,
    sourceUrl: row.sourceUrl as string,
    errorMessage: row.errorMessage as string,
    createdAt: row.createdAt as string,
  };
}

export function createIngestionJob(db: Database, merchantId: number): number {
  db.prepare("INSERT INTO ingestion_jobs (merchant_id) VALUES (?)").run(
    merchantId,
  );
  return db.prepare("SELECT last_insert_rowid() as id").value<[number]>()![0];
}

export function updateJobStatus(
  db: Database,
  jobId: number,
  status: JobStatus,
  updates?: {
    startedAt?: string;
    completedAt?: string;
    urlsDiscovered?: number;
    productsExtracted?: number;
    productsFailed?: number;
  },
): void {
  const sets = ["status = ?"];
  const params: (string | number | null)[] = [status];
  if (updates?.startedAt !== undefined) {
    sets.push("started_at = ?");
    params.push(updates.startedAt);
  }
  if (updates?.completedAt !== undefined) {
    sets.push("completed_at = ?");
    params.push(updates.completedAt);
  }
  if (updates?.urlsDiscovered !== undefined) {
    sets.push("urls_discovered = ?");
    params.push(updates.urlsDiscovered);
  }
  if (updates?.productsExtracted !== undefined) {
    sets.push("products_extracted = ?");
    params.push(updates.productsExtracted);
  }
  if (updates?.productsFailed !== undefined) {
    sets.push("products_failed = ?");
    params.push(updates.productsFailed);
  }
  params.push(jobId);
  db.prepare(`UPDATE ingestion_jobs SET ${sets.join(", ")} WHERE id = ?`).run(
    ...params,
  );
}

export function addExtractionError(
  db: Database,
  jobId: number,
  sourceUrl: string,
  errorMessage: string,
): void {
  db.prepare(
    "INSERT INTO extraction_errors (job_id, source_url, error_message) VALUES (?, ?, ?)",
  ).run(jobId, sourceUrl, errorMessage);
}

export function getIngestionJob(
  db: Database,
  jobId: number,
): IngestionJobDetail | undefined {
  const row = db.prepare(
    "SELECT id, merchant_id as merchantId, status, started_at as startedAt, completed_at as completedAt, urls_discovered as urlsDiscovered, products_extracted as productsExtracted, products_failed as productsFailed, created_at as createdAt FROM ingestion_jobs WHERE id = ?",
  ).get<Record<string, unknown>>(jobId);
  if (!row) return undefined;
  const errorRows = db.prepare(
    "SELECT id, job_id as jobId, source_url as sourceUrl, error_message as errorMessage, created_at as createdAt FROM extraction_errors WHERE job_id = ?",
  ).all<Record<string, unknown>>(jobId);
  return {
    ...deserializeJob(row),
    errors: errorRows.map(deserializeError),
  };
}

export function getJobsByMerchant(
  db: Database,
  merchantId: number,
  limit = 20,
  offset = 0,
): IngestionJob[] {
  const rows = db.prepare(
    "SELECT id, merchant_id as merchantId, status, started_at as startedAt, completed_at as completedAt, urls_discovered as urlsDiscovered, products_extracted as productsExtracted, products_failed as productsFailed, created_at as createdAt FROM ingestion_jobs WHERE merchant_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
  ).all<Record<string, unknown>>(merchantId, limit, offset);
  return rows.map(deserializeJob);
}

// --- Product Categories ---

export function addProductCategories(
  db: Database,
  productId: number,
  categories: string[],
): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO product_categories (product_id, category) VALUES (?, ?)",
  );
  for (const category of categories) {
    stmt.run(productId, category);
  }
}

export function listCategories(
  db: Database,
): { category: string; productCount: number }[] {
  return db.prepare(
    "SELECT category, COUNT(*) as productCount FROM product_categories GROUP BY category ORDER BY productCount DESC",
  ).all<{ category: string; productCount: number }>();
}

export function getProductsByCategory(
  db: Database,
  category: string,
  limit = 100,
  offset = 0,
): Product[] {
  const rows = db.prepare(
    "SELECT p.id, p.merchant_id as merchantId, p.source_url as sourceUrl, p.data, p.schema_def, p.created_at as createdAt FROM products p JOIN product_categories pc ON pc.product_id = p.id WHERE pc.category = ? LIMIT ? OFFSET ?",
  ).all<Record<string, unknown>>(category, limit, offset);
  return rows.map(deserializeProduct);
}

export function getCategoriesByMerchant(
  db: Database,
  merchantId: number,
): string[] {
  const rows = db.prepare(
    "SELECT DISTINCT pc.category FROM product_categories pc JOIN products p ON p.id = pc.product_id WHERE p.merchant_id = ?",
  ).all<{ category: string }>(merchantId);
  return rows.map((r) => r.category);
}

export function getProductCountByMerchant(
  db: Database,
  merchantId: number,
): number {
  return db.prepare(
    "SELECT COUNT(*) as count FROM products WHERE merchant_id = ?",
  ).value<[number]>(merchantId)![0];
}

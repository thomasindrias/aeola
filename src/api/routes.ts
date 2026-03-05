import type { Database } from "@db/sqlite";
import {
  getCategoriesByMerchant,
  getIngestionJob,
  getJobsByMerchant,
  getMerchant,
  getProduct,
  getProductsByCategory,
  getProductsByMerchant,
  listCategories,
  listMerchants,
  searchProducts,
} from "../storage/db.ts";

export function createApiHandler(db: Database) {
  return (request: Request): Response | null => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== "GET") return null;

    // GET /api/products/search?q=keyword&limit=20&offset=0
    if (path === "/api/products/search") {
      const q = url.searchParams.get("q") ?? "";
      const limit = parseInt(url.searchParams.get("limit") ?? "20");
      const offset = parseInt(url.searchParams.get("offset") ?? "0");
      const results = searchProducts(db, q, limit, offset);
      return json(results);
    }

    // GET /api/products/:id
    const productMatch = path.match(/^\/api\/products\/(\d+)$/);
    if (productMatch) {
      const product = getProduct(db, parseInt(productMatch[1]));
      if (!product) return json({ error: "Product not found" }, 404);
      return json(product);
    }

    // GET /api/merchants/:id/jobs
    const merchantJobsMatch = path.match(
      /^\/api\/merchants\/(\d+)\/jobs$/,
    );
    if (merchantJobsMatch) {
      const limit = parseInt(url.searchParams.get("limit") ?? "20");
      const offset = parseInt(url.searchParams.get("offset") ?? "0");
      const jobs = getJobsByMerchant(
        db,
        parseInt(merchantJobsMatch[1]),
        limit,
        offset,
      );
      return json(jobs);
    }

    // GET /api/merchants/:id/categories
    const merchantCategoriesMatch = path.match(
      /^\/api\/merchants\/(\d+)\/categories$/,
    );
    if (merchantCategoriesMatch) {
      const cats = getCategoriesByMerchant(
        db,
        parseInt(merchantCategoriesMatch[1]),
      );
      return json(cats);
    }

    // GET /api/merchants/:id/products?limit=20&offset=0
    const merchantProductsMatch = path.match(
      /^\/api\/merchants\/(\d+)\/products$/,
    );
    if (merchantProductsMatch) {
      const limit = parseInt(url.searchParams.get("limit") ?? "20");
      const offset = parseInt(url.searchParams.get("offset") ?? "0");
      const products = getProductsByMerchant(
        db,
        parseInt(merchantProductsMatch[1]),
        limit,
        offset,
      );
      return json(products);
    }

    // GET /api/merchants/:id
    const merchantMatch = path.match(/^\/api\/merchants\/(\d+)$/);
    if (merchantMatch) {
      const merchant = getMerchant(db, parseInt(merchantMatch[1]));
      if (!merchant) return json({ error: "Merchant not found" }, 404);
      return json(merchant);
    }

    // GET /api/merchants
    if (path === "/api/merchants") {
      return json(listMerchants(db));
    }

    // GET /api/jobs/:id
    const jobMatch = path.match(/^\/api\/jobs\/(\d+)$/);
    if (jobMatch) {
      const job = getIngestionJob(db, parseInt(jobMatch[1]));
      if (!job) return json({ error: "Job not found" }, 404);
      return json(job);
    }

    // GET /api/categories
    if (path === "/api/categories") {
      return json(listCategories(db));
    }

    // GET /api/categories/:name/products
    const categoryProductsMatch = path.match(
      /^\/api\/categories\/([^/]+)\/products$/,
    );
    if (categoryProductsMatch) {
      const categoryName = decodeURIComponent(categoryProductsMatch[1]);
      const limit = parseInt(url.searchParams.get("limit") ?? "20");
      const offset = parseInt(url.searchParams.get("offset") ?? "0");
      const products = getProductsByCategory(db, categoryName, limit, offset);
      return json(products);
    }

    return null;
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

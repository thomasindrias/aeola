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
import { mapProductToGoogleMerchant } from "../ucp/mapper.ts";
import { safeInt } from "../utils/parse.ts";

export function createApiHandler(db: Database) {
  return (request: Request): Response | null => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== "GET") return null;

    // GET /api/products/search?q=keyword&limit=20&offset=0
    if (path === "/api/products/search") {
      const q = url.searchParams.get("q") ?? "";
      const limit = safeInt(url.searchParams.get("limit"), 20);
      const offset = safeInt(url.searchParams.get("offset"), 0);
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
      const limit = safeInt(url.searchParams.get("limit"), 20);
      const offset = safeInt(url.searchParams.get("offset"), 0);
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
      const limit = safeInt(url.searchParams.get("limit"), 20);
      const offset = safeInt(url.searchParams.get("offset"), 0);
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
      const limit = safeInt(url.searchParams.get("limit"), 20);
      const offset = safeInt(url.searchParams.get("offset"), 0);
      const products = getProductsByCategory(db, categoryName, limit, offset);
      return json(products);
    }

    // GET /api/ucp/products/search?q=keyword&limit=20&offset=0&merchant_id=1
    if (path === "/api/ucp/products/search") {
      const q = url.searchParams.get("q") ?? "";
      const limit = safeInt(url.searchParams.get("limit"), 20);
      const offset = safeInt(url.searchParams.get("offset"), 0);
      const rawMerchantId = url.searchParams.get("merchant_id");
      const merchantId = rawMerchantId !== null
        ? safeInt(rawMerchantId, -1)
        : undefined;
      const results = searchProducts(
        db,
        q,
        limit,
        offset,
        undefined,
        merchantId !== undefined && merchantId > 0 ? merchantId : undefined,
      );
      return json(results.map(mapProductToGoogleMerchant));
    }

    // GET /api/ucp/merchants/:id/products — Google Merchant format export
    const ucpMerchantProductsMatch = path.match(
      /^\/api\/ucp\/merchants\/(\d+)\/products$/,
    );
    if (ucpMerchantProductsMatch) {
      const limit = safeInt(url.searchParams.get("limit"), 20);
      const offset = safeInt(url.searchParams.get("offset"), 0);
      const products = getProductsByMerchant(
        db,
        parseInt(ucpMerchantProductsMatch[1]),
        limit,
        offset,
      );
      return json(products.map(mapProductToGoogleMerchant));
    }

    // GET /api/ucp/products/:id — single product in Google Merchant format
    const ucpProductMatch = path.match(/^\/api\/ucp\/products\/(\d+)$/);
    if (ucpProductMatch) {
      const product = getProduct(db, parseInt(ucpProductMatch[1]));
      if (!product) return json({ error: "Product not found" }, 404);
      return json(mapProductToGoogleMerchant(product));
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

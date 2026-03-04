import type { Database } from "@db/sqlite";
import {
  getProduct,
  getProductsByMerchant,
  getMerchant,
  listMerchants,
  searchProducts,
} from "../storage/db.ts";

export function createApiHandler(db: Database) {
  return async (request: Request): Promise<Response | null> => {
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

    return null;
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

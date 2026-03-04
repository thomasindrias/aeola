import { PlaywrightCrawler } from "crawlee";

const PRODUCT_PATH_PATTERNS = [
  /\/product[s]?\//i,
  /\/item[s]?\//i,
  /\/p\//i,
  /\/shop\/.+/i,
  /\/collections?\/.+\/.+/i,
];

/**
 * Build glob patterns for enqueueLinks to discover product URLs.
 */
export function buildProductGlobs(baseUrl: string): string[] {
  const base = baseUrl.replace(/\/$/, "");
  return [
    `${base}/product/**`,
    `${base}/products/**`,
    `${base}/item/**`,
    `${base}/items/**`,
    `${base}/p/**`,
    `${base}/shop/**`,
    `${base}/collections/**`,
  ];
}

/**
 * Check if a URL looks like a product page.
 */
export function isProductUrl(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.hostname !== base.hostname) return false;
    return PRODUCT_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname));
  } catch {
    return false;
  }
}

/**
 * Discover product URLs on a merchant's website using Crawlee.
 * Returns a deduplicated list of product page URLs.
 */
export async function discoverProductUrls(
  merchantUrl: string,
  maxRequests = 50,
): Promise<string[]> {
  const productUrls: Set<string> = new Set();

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxRequests,
    headless: true,
    async requestHandler({ request, enqueueLinks }) {
      // Check if current page is a product page
      if (isProductUrl(request.url, merchantUrl)) {
        productUrls.add(request.url);
      }

      // Enqueue links matching product URL patterns
      await enqueueLinks({
        globs: buildProductGlobs(merchantUrl),
      });

      // Also enqueue all same-domain links (for discovering category pages)
      await enqueueLinks({
        globs: [`${new URL(merchantUrl).origin}/**`],
      });
    },
  });

  await crawler.run([merchantUrl]);

  return [...productUrls];
}

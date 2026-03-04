import { chromium, type Page } from "playwright";
import { retry } from "../utils/retry.ts";

const PRODUCT_PATH_PATTERNS = [
  /\/product[s]?\//i,
  /\/item[s]?\//i,
  /\/p\//i,
  /\/shop\/.+/i,
  /\/collections?\/.+\/.+/i,
  /\/catalogue\/(?!category\/)[\w-]+_\d+\//i,
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
    return PRODUCT_PATH_PATTERNS.some((pattern) =>
      pattern.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Extract all same-origin links from a page.
 */
function extractLinks(page: Page, baseOrigin: string): Promise<string[]> {
  return page.evaluate((origin: string) => {
    // This runs in the browser context (DOM available)
    return Array.from(
      // @ts-expect-error: DOM API available in browser context
      document.querySelectorAll("a[href]"),
    )
      .map((a: unknown) => {
        try {
          return new URL((a as { href: string }).href, origin).href;
        } catch {
          return null;
        }
      })
      .filter((href: unknown): href is string =>
        href !== null && typeof href === "string" && href.startsWith(origin)
      );
  }, baseOrigin);
}

/**
 * Discover product URLs on a merchant's website using Playwright directly.
 * Uses chromium.launch() instead of Crawlee's PlaywrightCrawler to avoid
 * Deno compatibility issues with launchPersistentContext.
 * Returns a deduplicated list of product page URLs.
 */
export async function discoverProductUrls(
  merchantUrl: string,
  maxRequests = 50,
): Promise<string[]> {
  const productUrls: Set<string> = new Set();
  const visited: Set<string> = new Set();
  const queued: Set<string> = new Set([merchantUrl]);
  const queue: string[] = [merchantUrl];
  const origin = new URL(merchantUrl).origin;
  let consecutiveErrors = 0;

  const browser = await chromium.launch({ headless: true });

  try {
    let page = await browser.newPage();

    while (queue.length > 0 && visited.size < maxRequests) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        await retry(
          () =>
            page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" }),
          { maxAttempts: 2, baseDelayMs: 500 },
        );
        consecutiveErrors = 0;
      } catch {
        consecutiveErrors++;
        // Replace page after 3 consecutive navigation failures
        if (consecutiveErrors >= 3) {
          try {
            await page.close();
          } catch { /* ignore */ }
          page = await browser.newPage();
          consecutiveErrors = 0;
        }
        continue;
      }

      if (isProductUrl(url, merchantUrl)) {
        productUrls.add(url);
      }

      const links = await extractLinks(page, origin);
      for (const link of links) {
        if (!visited.has(link) && !queued.has(link)) {
          queued.add(link);
          // Prioritize product-looking URLs by pushing to front
          if (isProductUrl(link, merchantUrl)) {
            queue.unshift(link);
          } else {
            queue.push(link);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  return [...productUrls];
}

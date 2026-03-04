import type { Database } from "@db/sqlite";
import { addProduct, getOrCreateMerchant } from "../storage/db.ts";
import type { Logger } from "../utils/logger.ts";

export interface IngestOptions {
  url: string;
  name: string;
  discover: (url: string) => Promise<string[]>;
  extractSnapshot: (url: string) => Promise<string>;
  processWithLLM: (
    client: unknown,
    snapshotText: string,
    sourceUrl: string,
  ) => Promise<
    { schema: Record<string, unknown>; data: Record<string, unknown> }
  >;
  openaiClient?: unknown;
  concurrency?: number;
  logger?: Logger;
}

export interface IngestResult {
  merchantId: number;
  productsIngested: number;
  urlsDiscovered: number;
  errors: string[];
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
}

export async function ingestMerchant(
  db: Database,
  options: IngestOptions,
): Promise<IngestResult> {
  const {
    url,
    name,
    discover,
    extractSnapshot,
    processWithLLM,
    openaiClient,
    concurrency = 5,
    logger: log,
  } = options;

  const merchantId = getOrCreateMerchant(db, { url, name });

  // Phase 1: Discover product URLs
  const productUrls = await discover(url);
  log?.info("discovery complete", { url, urlsDiscovered: productUrls.length });

  let productsIngested = 0;
  const errors: string[] = [];

  // Phase 2 & 3: Extract snapshot + Process with LLM with bounded concurrency
  await processWithConcurrency(productUrls, concurrency, async (productUrl) => {
    try {
      const snapshotText = await extractSnapshot(productUrl);
      const { schema, data } = await processWithLLM(
        openaiClient,
        snapshotText,
        productUrl,
      );
      addProduct(db, { merchantId, sourceUrl: productUrl, data, schema });
      productsIngested++;
    } catch (e) {
      const msg = (e as Error).message;
      errors.push(`Failed ${productUrl}: ${msg}`);
      log?.warn("extraction failed", { productUrl, error: msg });
    }
  });

  log?.info("ingest complete", {
    url,
    productsIngested,
    errors: errors.length,
  });
  return {
    merchantId,
    productsIngested,
    urlsDiscovered: productUrls.length,
    errors,
  };
}

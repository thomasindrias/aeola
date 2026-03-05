import type { Database } from "@db/sqlite";
import {
  addExtractionError,
  addProduct,
  addProductCategories,
  createIngestionJob,
  getOrCreateMerchant,
  updateJobStatus,
} from "../storage/db.ts";
import type { Logger } from "../utils/logger.ts";
import {
  extractCategories,
  extractCategoriesFromProduct,
  notifyRegistry,
} from "../registry/notify.ts";

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
  registryEnabled?: boolean;
  registryUrl?: string;
  registryFetchFn?: typeof fetch;
}

export interface IngestResult {
  jobId: number;
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
  const jobId = createIngestionJob(db, merchantId);
  updateJobStatus(db, jobId, "in_progress", {
    startedAt: new Date().toISOString(),
  });

  // Phase 1: Discover product URLs
  const productUrls = await discover(url);
  log?.info("discovery complete", { url, urlsDiscovered: productUrls.length });
  updateJobStatus(db, jobId, "in_progress", {
    urlsDiscovered: productUrls.length,
  });

  let productsIngested = 0;
  let productsFailed = 0;
  const errors: string[] = [];
  const productDataList: Record<string, unknown>[] = [];

  // Phase 2 & 3: Extract snapshot + Process with LLM with bounded concurrency
  await processWithConcurrency(productUrls, concurrency, async (productUrl) => {
    try {
      const snapshotText = await extractSnapshot(productUrl);
      const { schema, data } = await processWithLLM(
        openaiClient,
        snapshotText,
        productUrl,
      );
      const productId = addProduct(db, {
        merchantId,
        sourceUrl: productUrl,
        data,
        schema,
      });
      const categories = extractCategoriesFromProduct(data);
      if (categories.length > 0) {
        addProductCategories(db, productId, categories);
      }
      productDataList.push(data);
      productsIngested++;
    } catch (e) {
      const msg = (e as Error).message;
      errors.push(`Failed ${productUrl}: ${msg}`);
      addExtractionError(db, jobId, productUrl, msg);
      productsFailed++;
      log?.warn("extraction failed", { productUrl, error: msg });
    }
  });

  const finalStatus = productsIngested === 0 && errors.length > 0
    ? "failed"
    : "completed";
  updateJobStatus(db, jobId, finalStatus, {
    completedAt: new Date().toISOString(),
    productsExtracted: productsIngested,
    productsFailed,
  });

  log?.info("ingest complete", {
    url,
    productsIngested,
    errors: errors.length,
  });

  if (options.registryEnabled && options.registryUrl) {
    const domain = new URL(url).hostname;
    const categories = extractCategories(productDataList);
    notifyRegistry(options.registryUrl, {
      domain,
      merchantName: name,
      productCount: productsIngested,
      categories,
    }, { logger: log, fetchFn: options.registryFetchFn }).catch(() => {});
  }

  return {
    jobId,
    merchantId,
    productsIngested,
    urlsDiscovered: productUrls.length,
    errors,
  };
}

import type { Logger } from "../utils/logger.ts";

export interface RegistryPayload {
  domain: string;
  merchantName: string;
  productCount: number;
  categories: string[];
}

export function extractCategories(
  products: Record<string, unknown>[],
): string[] {
  const categoryKeys = /^(categor(y|ies)|type|department)$/i;
  const seen = new Set<string>();
  for (const product of products) {
    for (const [key, value] of Object.entries(product)) {
      if (categoryKeys.test(key) && typeof value === "string" && value) {
        seen.add(value);
      }
    }
  }
  return [...seen];
}

export async function notifyRegistry(
  registryUrl: string,
  payload: RegistryPayload,
  options?: { logger?: Logger; fetchFn?: typeof fetch },
): Promise<void> {
  const log = options?.logger;
  const doFetch = options?.fetchFn ?? fetch;
  try {
    const parsed = new URL(registryUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      log?.warn("registry URL must be http/https", { registryUrl });
      return;
    }
    await doFetch(registryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    log?.debug("registry notified", { domain: payload.domain });
  } catch (err) {
    log?.warn("registry notification failed", {
      error: (err as Error).message,
    });
  }
}

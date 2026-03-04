import OpenAI from "@openai/openai";
import { discoverProductUrls } from "../spider/discovery.ts";
import { getPageSnapshot } from "../extractor/snapshot.ts";
import { extractProductData } from "../brain/extractor.ts";
import type { IngestOptions } from "./ingest.ts";

export function buildIngestOptions(url: string, name: string): IngestOptions {
  const client = new OpenAI();
  return {
    url,
    name,
    discover: discoverProductUrls,
    extractSnapshot: getPageSnapshot,
    processWithLLM: (client, snapshotText) =>
      extractProductData(client as OpenAI, snapshotText),
    openaiClient: client,
    // Single concurrency: discovery already uses Playwright, avoid parallel browser sessions
    concurrency: 1,
  };
}

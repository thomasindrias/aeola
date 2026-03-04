import type OpenAI from "@openai/openai";

export interface ExtractionResult {
  schema: Record<string, unknown>;
  data: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are a product data extraction engine. You receive compact accessibility tree snapshots from e-commerce product pages. Each line contains an element reference, role, and text content.

Your task:
1. Dynamically infer the most logical JSON schema for this product
2. Extract structured data according to that schema

Respond ONLY with valid JSON:
{
  "schema": {
    "type": "product",
    "properties": { "fieldName": "fieldType", ... }
  },
  "data": {
    "fieldName": value, ...
  }
}

Rules:
- Infer field names from content (e.g., "price", "name", "sizes")
- Use types: string, number, boolean, array
- Extract prices as numbers without currency symbols
- Include "currency" field if price is found
- Ignore navigation elements (buttons, links) — focus on product data
- Use the source URL (if provided) to identify the PRIMARY product — extract only that product's data
- Do NOT hallucinate data not present in the snapshot`;

export async function extractProductData(
  client: OpenAI,
  snapshotText: string,
  sourceUrl?: string,
): Promise<ExtractionResult> {
  const userMessage = sourceUrl
    ? `Source URL: ${sourceUrl}\n\nSnapshot:\n${snapshotText}`
    : snapshotText;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from LLM");
  }

  const parsed = JSON.parse(content) as ExtractionResult;
  if (!parsed.schema || !parsed.data) {
    throw new Error("Missing required fields: schema or data");
  }
  return parsed;
}

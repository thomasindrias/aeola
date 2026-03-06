import type { Product } from "../storage/db.ts";

export interface GoogleMerchantProduct {
  offerId: string;
  link: string;
  productAttributes: {
    title: string;
    description: string;
    imageLink?: string;
    availability: string;
    price: { value: string; currency: string };
    additionalAttributes?: Record<string, unknown>;
  };
}

const TITLE_KEYS = ["name", "title", "product_name", "productName"];
const DESC_KEYS = ["description", "desc", "product_description"];
const IMAGE_KEYS = [
  "image",
  "imageUrl",
  "image_url",
  "imageLink",
  "photo",
  "thumbnail",
];
const IMAGES_KEYS = ["images", "photos", "gallery"];
const AVAIL_KEYS = ["availability", "in_stock", "inStock", "stock_status"];
const PRICE_KEYS = ["price", "cost", "amount"];
const CURRENCY_KEYS = ["currency", "currencyCode", "currency_code"];

const MAPPED_KEYS = new Set([
  ...TITLE_KEYS,
  ...DESC_KEYS,
  ...IMAGE_KEYS,
  ...IMAGES_KEYS,
  ...AVAIL_KEYS,
  ...PRICE_KEYS,
  ...CURRENCY_KEYS,
]);

function findField(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) return data[key];
  }
  return undefined;
}

function normalizePrice(raw: unknown): string {
  if (raw === undefined || raw === null) return "0";
  if (typeof raw === "number") return String(raw);
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  return cleaned || "0";
}

function normalizeAvailability(raw: unknown): string {
  if (raw === undefined || raw === null) return "out_of_stock";
  if (typeof raw === "boolean") return raw ? "in_stock" : "out_of_stock";
  const val = String(raw).toLowerCase();
  if (
    val === "true" ||
    val === "1" ||
    val.includes("in_stock") ||
    val.includes("in stock")
  ) {
    return "in_stock";
  }
  if (val === "false" || val === "0" || val.includes("out")) {
    return "out_of_stock";
  }
  return val;
}

export function mapProductToGoogleMerchant(
  product: Product,
): GoogleMerchantProduct {
  const d = product.data;

  const imageFromArray = findField(d, IMAGES_KEYS);
  const imageLink = (findField(d, IMAGE_KEYS) as string | undefined) ??
    (Array.isArray(imageFromArray) ? (imageFromArray[0] as string) : undefined);

  const additionalAttributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(d)) {
    if (!MAPPED_KEYS.has(key)) additionalAttributes[key] = value;
  }

  return {
    offerId: String(product.id),
    link: product.sourceUrl,
    productAttributes: {
      title: String(findField(d, TITLE_KEYS) ?? ""),
      description: String(findField(d, DESC_KEYS) ?? ""),
      imageLink: imageLink ?? undefined,
      availability: normalizeAvailability(findField(d, AVAIL_KEYS)),
      price: {
        value: normalizePrice(findField(d, PRICE_KEYS)),
        currency: String(findField(d, CURRENCY_KEYS) ?? "USD"),
      },
      ...(Object.keys(additionalAttributes).length > 0
        ? { additionalAttributes }
        : {}),
    },
  };
}

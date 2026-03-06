export function safeInt(
  value: string | null | undefined,
  fallback: number,
): number {
  if (value == null) return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

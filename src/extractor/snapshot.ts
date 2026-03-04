/**
 * Type for the CLI executor function.
 * Accepts a URL, returns the snapshot text.
 * Injectable for testing — production uses the real agent-browser CLI.
 */
export type SnapshotExecutor = (url: string) => Promise<string>;

export type CommandExecutor = (
  args: string[],
) => Promise<{ success: boolean; stdout: string }>;

export const CONTENT_SELECTORS = [
  "main",
  "[role='main']",
  "article",
  "#content",
  ".product",
  "#product",
  ".product-detail",
  ".product-page",
];

/**
 * Parse snapshot text from agent-browser output.
 * Returns the compact accessibility tree text, ready for LLM processing.
 */
export function parseSnapshotText(rawOutput: string): string {
  return rawOutput.trim();
}

async function defaultCommandExecutor(
  args: string[],
): Promise<{ success: boolean; stdout: string }> {
  const cmd = new Deno.Command("agent-browser", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  return {
    success: result.success,
    stdout: new TextDecoder().decode(result.stdout),
  };
}

export async function tryScopedSnapshot(
  selector: string,
  executor?: CommandExecutor,
): Promise<string | null> {
  const run = executor ?? defaultCommandExecutor;
  try {
    const result = await run(["snapshot", "-i", "-c", "-s", selector]);
    if (!result.success) return null;
    const trimmed = result.stdout.trim();
    return trimmed.length > 50 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Default executor: shells out to agent-browser CLI.
 * Opens the URL, tries scoped selectors first, falls back to full-page snapshot.
 */
export async function defaultSnapshotExecutor(url: string): Promise<string> {
  // Validate URL before passing to CLI
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  // Open URL in agent-browser
  const openCmd = new Deno.Command("agent-browser", {
    args: ["open", parsed.href],
    stdout: "piped",
    stderr: "piped",
  });
  const openResult = await openCmd.output();
  if (!openResult.success) {
    const error = new TextDecoder().decode(openResult.stderr);
    throw new Error(`agent-browser open failed: ${error}`);
  }

  // Try scoped selectors — focus on main content area
  for (const selector of CONTENT_SELECTORS) {
    const scoped = await tryScopedSnapshot(selector);
    if (scoped !== null) {
      return scoped;
    }
  }

  // Fallback: full-page snapshot
  const snapshotCmd = new Deno.Command("agent-browser", {
    args: ["snapshot", "-i", "-c"],
    stdout: "piped",
    stderr: "piped",
  });
  const snapshotResult = await snapshotCmd.output();
  if (!snapshotResult.success) {
    const error = new TextDecoder().decode(snapshotResult.stderr);
    throw new Error(`agent-browser snapshot failed: ${error}`);
  }

  return new TextDecoder().decode(snapshotResult.stdout);
}

/**
 * Get a compact accessibility tree snapshot of a page.
 * Uses agent-browser for AI-optimized output (~200-400 tokens per page).
 */
export async function getPageSnapshot(
  url: string,
  executor: SnapshotExecutor = defaultSnapshotExecutor,
): Promise<string> {
  const rawOutput = await executor(url);
  return parseSnapshotText(rawOutput);
}

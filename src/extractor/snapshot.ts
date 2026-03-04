/**
 * Type for the CLI executor function.
 * Accepts a URL, returns the snapshot text.
 * Injectable for testing — production uses the real agent-browser CLI.
 */
export type SnapshotExecutor = (url: string) => Promise<string>;

/**
 * Parse snapshot text from agent-browser output.
 * Returns the compact accessibility tree text, ready for LLM processing.
 */
export function parseSnapshotText(rawOutput: string): string {
  return rawOutput.trim();
}

/**
 * Default executor: shells out to agent-browser CLI.
 * Opens the URL, takes a compact interactive snapshot, closes the session.
 */
export async function defaultSnapshotExecutor(url: string): Promise<string> {
  // Open URL in agent-browser
  const openCmd = new Deno.Command("agent-browser", {
    args: ["open", url],
    stdout: "piped",
    stderr: "piped",
  });
  const openResult = await openCmd.output();
  if (!openResult.success) {
    const error = new TextDecoder().decode(openResult.stderr);
    throw new Error(`agent-browser open failed: ${error}`);
  }

  // Take compact interactive snapshot
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

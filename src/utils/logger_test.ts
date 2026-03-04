import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { createLogger } from "./logger.ts";

describe("Logger", () => {
  it("should output JSON with level, message, and timestamp", () => {
    const output: string[] = [];
    const logger = createLogger("info", (line) => output.push(line));

    logger.info("server started", { port: 8000 });

    const parsed = JSON.parse(output[0]);
    assertEquals(parsed.level, "info");
    assertEquals(parsed.msg, "server started");
    assertEquals(parsed.port, 8000);
    assertEquals(typeof parsed.ts, "string");
  });

  it("should respect log level", () => {
    const output: string[] = [];
    const logger = createLogger("warn", (line) => output.push(line));

    logger.info("ignored");
    logger.warn("included");

    assertEquals(output.length, 1);
    assertEquals(JSON.parse(output[0]).level, "warn");
  });

  it("should default to info level", () => {
    const output: string[] = [];
    const logger = createLogger(undefined, (line) => output.push(line));

    logger.debug("ignored");
    logger.info("included");

    assertEquals(output.length, 1);
  });
});

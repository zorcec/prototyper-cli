import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getConfigPath,
  hasProtoDir,
  ensureProtoDir,
  readConfig,
  writeConfig,
} from "../../src/core/config.js";
import type { ProtoConfig } from "../../src/core/types.js";

describe("config", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-config-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("getConfigPath returns .proto/config.json path", () => {
    expect(getConfigPath(tempDir)).toBe(join(tempDir, ".proto", "config.json"));
  });

  it("hasProtoDir returns false when .proto does not exist", () => {
    expect(hasProtoDir(tempDir)).toBe(false);
  });

  it("hasProtoDir returns true after ensureProtoDir", () => {
    ensureProtoDir(tempDir);
    expect(hasProtoDir(tempDir)).toBe(true);
  });

  it("readConfig returns defaults when no config file", () => {
    const config = readConfig(tempDir);
    expect(config.mode).toBe("prototype");
    expect(config.port).toBe(3700);
  });

  it("writeConfig creates config file and readConfig reads it", () => {
    const config: ProtoConfig = { mode: "attach", url: "http://localhost:3000", port: 4000 };
    writeConfig(tempDir, config);

    expect(existsSync(getConfigPath(tempDir))).toBe(true);

    const read = readConfig(tempDir);
    expect(read.mode).toBe("attach");
    expect(read.url).toBe("http://localhost:3000");
    expect(read.port).toBe(4000);
  });

  it("writeConfig creates .proto directory if missing", () => {
    expect(hasProtoDir(tempDir)).toBe(false);
    writeConfig(tempDir, { mode: "prototype", port: 3700 });
    expect(hasProtoDir(tempDir)).toBe(true);
  });

  it("readConfig merges with defaults for partial config", () => {
    ensureProtoDir(tempDir);
    const configPath = getConfigPath(tempDir);
    const partial = JSON.stringify({ mode: "attach" });
    const { writeFileSync } = require("node:fs");
    writeFileSync(configPath, partial, "utf-8");

    const config = readConfig(tempDir);
    expect(config.mode).toBe("attach");
    expect(config.port).toBe(3700); // default
  });
});

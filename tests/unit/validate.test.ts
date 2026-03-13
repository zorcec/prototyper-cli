import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateFile } from "../../src/commands/validate.js";

describe("validateFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-validate-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("passes for valid HTML with proto-ids", () => {
    const html = `<!DOCTYPE html><html><body>
<div data-proto-id="hero">Hero</div>
<button data-proto-id="cta">Click</button>
</body></html>`;

    const filePath = join(tempDir, "valid.html");
    writeFileSync(filePath, html, "utf-8");

    const result = validateFile(filePath);
    expect(result.valid).toBe(true);
    expect(result.stats.elementsWithIds).toBe(2);
  });

  it("detects missing IDs when compared to previous version", () => {
    const previousHtml = `<div data-proto-id="hero">Hero</div>
<div data-proto-id="sidebar">Side</div>
<div data-proto-id="footer">Foot</div>`;

    const currentHtml = `<div data-proto-id="hero">Hero Updated</div>`;

    const prevPath = join(tempDir, "previous.html");
    const currPath = join(tempDir, "current.html");
    writeFileSync(prevPath, previousHtml, "utf-8");
    writeFileSync(currPath, currentHtml, "utf-8");

    const result = validateFile(currPath, prevPath);
    expect(result.valid).toBe(false);
    const errors = result.issues.filter((i) => i.type === "error");
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("warns about unresolved annotations", () => {
    const html = `<!-- @TODO[data-proto-id="btn"] Fix me -->
<button data-proto-id="btn">Click</button>`;

    const filePath = join(tempDir, "todos.html");
    writeFileSync(filePath, html, "utf-8");

    const result = validateFile(filePath);
    expect(result.stats.unresolvedTodos).toBe(1);
  });

  it("detects duplicate proto-ids", () => {
    const html = `<div data-proto-id="dup">A</div>
<div data-proto-id="dup">B</div>`;

    const filePath = join(tempDir, "dups.html");
    writeFileSync(filePath, html, "utf-8");

    const result = validateFile(filePath);
    expect(result.valid).toBe(false);
  });

  it("passes when all previous IDs preserved", () => {
    const previousHtml = `<div data-proto-id="a">A</div>
<div data-proto-id="b">B</div>`;

    const currentHtml = `<div data-proto-id="a">A Updated</div>
<div data-proto-id="b">B Updated</div>
<div data-proto-id="c">C New</div>`;

    const prevPath = join(tempDir, "prev.html");
    const currPath = join(tempDir, "curr.html");
    writeFileSync(prevPath, previousHtml, "utf-8");
    writeFileSync(currPath, currentHtml, "utf-8");

    const result = validateFile(currPath, prevPath);
    expect(result.valid).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(process.cwd(), "dist", "index.js");
const run = (args: string) =>
  execSync(`node ${CLI} ${args}`, { encoding: "utf-8" });

describe("proto export (e2e)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-e2e-export-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports annotated HTML as a prompt", () => {
    const html = `<!DOCTYPE html><html><body>
<!-- @TODO[data-proto-id="hero"] Make it bigger -->
<div data-proto-id="hero">Hero Section</div>
</body></html>`;

    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, html, "utf-8");

    const output = run(`export ${filePath}`);
    expect(output).toContain("Export ready");
    expect(output).toContain("@TODO");
    expect(output).toContain("Hero Section");
  });

  it("shows annotation count", () => {
    const html = `<!-- @TODO[data-proto-id="a"] Fix -->
<!-- @FEATURE[data-proto-id="b"] Add -->
<div data-proto-id="a">A</div>
<div data-proto-id="b">B</div>`;

    const filePath = join(tempDir, "multi.html");
    writeFileSync(filePath, html, "utf-8");

    const output = run(`export ${filePath}`);
    expect(output).toContain("Annotations: 2");
  });

  it("exports clean HTML without annotations", () => {
    const html = `<div data-proto-id="clean">Clean</div>`;
    const filePath = join(tempDir, "clean.html");
    writeFileSync(filePath, html, "utf-8");

    const output = run(`export ${filePath}`);
    expect(output).toContain("Annotations: 0");
  });

  it("writes prompt to file with --output flag", () => {
    const html = `<div data-proto-id="test">Test</div>`;
    const filePath = join(tempDir, "source.html");
    const outputPath = join(tempDir, "prompt.txt");
    writeFileSync(filePath, html, "utf-8");

    run(`export ${filePath} --output ${outputPath}`);

    const promptContent = readFileSync(outputPath, "utf-8");
    expect(promptContent).toContain("Test");
    expect(promptContent).toContain("```html");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { serve } from "../../src/server/server.js";
import type { ServeInstance } from "../../src/server/server.js";

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Test</title></head>
<body>
  <div data-proto-id="hero-section">
    <h1 data-proto-id="main-title">Hello World</h1>
    <button data-proto-id="cta-button">Click Me</button>
  </div>
</body>
</html>`;

describe("proto serve (e2e)", () => {
  let tempDir: string;
  let instance: ServeInstance | null = null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-e2e-serve-"));
  });

  afterEach(async () => {
    if (instance) {
      await instance.close();
      instance = null;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("serves a single HTML file", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3750, open: false });
    expect(instance.url).toBe("http://localhost:3750");

    const response = await fetch("http://localhost:3750/");
    expect(response.ok).toBe(true);
    const body = await response.text();
    expect(body).toContain("Hello World");
    expect(body).toContain("data-proto-overlay");
  });

  it("injects overlay script into served HTML", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3751, open: false });

    const response = await fetch("http://localhost:3751/");
    const body = await response.text();
    expect(body).toContain("data-proto-overlay");
    expect(body).toContain("ws://localhost:3751");
  });

  it("serves directory with multiple HTML files", async () => {
    writeFileSync(join(tempDir, "page1.html"), SAMPLE_HTML, "utf-8");
    writeFileSync(
      join(tempDir, "page2.html"),
      SAMPLE_HTML.replace("Hello World", "Page Two"),
      "utf-8",
    );

    instance = await serve(tempDir, { port: 3752, open: false });

    const indexResponse = await fetch("http://localhost:3752/");
    const indexBody = await indexResponse.text();
    expect(indexBody).toContain("page1.html");
    expect(indexBody).toContain("page2.html");

    const page1 = await fetch("http://localhost:3752/page1.html");
    expect(await page1.text()).toContain("Hello World");

    const page2 = await fetch("http://localhost:3752/page2.html");
    expect(await page2.text()).toContain("Page Two");
  });

  it("accepts annotations via POST /api/annotate", async () => {
    const filePath = join(tempDir, "annotate-test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3753, open: false });

    const response = await fetch("http://localhost:3753/api/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "annotate-test.html",
        targetSelector: 'data-proto-id="cta-button"',
        tag: "TODO",
        text: "Make this button bigger",
      }),
    });

    const result = await response.json();
    expect(result.success).toBe(true);

    const updatedHtml = readFileSync(filePath, "utf-8");
    expect(updatedHtml).toContain("@TODO");
    expect(updatedHtml).toContain("Make this button bigger");
  });

  it("rejects annotation with missing fields", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3754, open: false });

    const response = await fetch("http://localhost:3754/api/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "test.html" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects annotation for non-existent file", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3755, open: false });

    const response = await fetch("http://localhost:3755/api/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "nonexistent.html",
        targetSelector: 'data-proto-id="hero"',
        tag: "TODO",
        text: "Fix it",
      }),
    });

    expect(response.status).toBe(404);
  });

  it("throws for empty directory with no HTML files", async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "proto-empty-"));
    try {
      await expect(
        serve(emptyDir, { port: 3756, open: false }),
      ).rejects.toThrow("No HTML files");
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

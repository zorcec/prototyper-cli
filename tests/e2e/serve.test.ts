import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
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

  // ── Task API tests ──────────────────────────────────────────────────────
  it("GET /api/tasks returns empty list initially", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3753, open: false });

    const response = await fetch("http://localhost:3753/api/tasks");
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.tasks).toEqual([]);
  });

  it("POST /api/tasks creates a task", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3754, open: false });

    const response = await fetch("http://localhost:3754/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fix the button",
        description: "Make it bigger",
        selector: '[data-proto-id="cta-button"]',
      }),
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.task.id).toBeDefined();
    expect(result.task.title).toBe("Fix the button");

    // Verify it appears in the list
    const listRes = await fetch("http://localhost:3754/api/tasks");
    const listData = await listRes.json();
    expect(listData.tasks).toHaveLength(1);
  });

  it("POST /api/tasks rejects missing fields", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3755, open: false });

    const response = await fetch("http://localhost:3755/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No selector" }),
    });

    expect(response.status).toBe(400);
  });

  it("PATCH /api/tasks/:id updates a task", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3756, open: false });

    // Create a task first
    const createRes = await fetch("http://localhost:3756/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Update me",
        selector: '[data-proto-id="hero-section"]',
      }),
    });
    const { task } = await createRes.json();

    // Update it
    const updateRes = await fetch(`http://localhost:3756/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    const updateData = await updateRes.json();
    expect(updateData.success).toBe(true);
    expect(updateData.task.status).toBe("done");
  });

  it("DELETE /api/tasks/:id removes a task", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3757, open: false });

    // Create then delete
    const createRes = await fetch("http://localhost:3757/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Delete me",
        selector: '[data-proto-id="main-title"]',
      }),
    });
    const { task } = await createRes.json();

    const deleteRes = await fetch(`http://localhost:3757/api/tasks/${task.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.ok).toBe(true);

    const listRes = await fetch("http://localhost:3757/api/tasks");
    const listData = await listRes.json();
    expect(listData.tasks).toHaveLength(0);
  });

  it("PATCH /api/tasks/:id returns 404 for non-existent task", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3758, open: false });

    const response = await fetch("http://localhost:3758/api/tasks/nonexist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(response.status).toBe(404);
  });

  // ── Legacy annotation API ───────────────────────────────────────────────
  it("accepts annotations via POST /api/annotate (creates task)", async () => {
    const filePath = join(tempDir, "annotate-test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3759, open: false });

    const response = await fetch("http://localhost:3759/api/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "annotate-test.html",
        targetSelector: 'data-proto-id="cta-button"',
        text: "Make this button bigger",
      }),
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.task).toBeDefined();
    expect(result.task.title).toContain("Make this button bigger");
  });

  it("rejects annotation with missing fields", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3760, open: false });

    const response = await fetch("http://localhost:3760/api/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "test.html" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects annotation for non-existent file", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3761, open: false });

    const response = await fetch("http://localhost:3761/api/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "nonexistent.html",
        targetSelector: 'data-proto-id="hero"',
        text: "Fix it",
      }),
    });

    expect(response.status).toBe(404);
  });

  it("throws for empty directory with no HTML files", async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "proto-empty-"));
    try {
      await expect(
        serve(emptyDir, { port: 3762, open: false }),
      ).rejects.toThrow("No HTML files");
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("creates .proto directory on startup", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3763, open: false });

    const { existsSync } = await import("node:fs");
    expect(existsSync(join(tempDir, ".proto", "tasks"))).toBe(true);
    expect(existsSync(join(tempDir, ".proto", "screenshots"))).toBe(true);
  });

  it("DELETE /api/tasks/:id/screenshot removes screenshot and returns success", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3764, open: false });

    // Create a task with a screenshot
    const createRes = await fetch("http://localhost:3764/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Screenshot task",
        selector: '[data-proto-id="cta-button"]',
        screenshot:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      }),
    });
    const { task } = await createRes.json();

    // Delete the screenshot
    const deleteRes = await fetch(
      `http://localhost:3764/api/tasks/${task.id}/screenshot`,
      { method: "DELETE" },
    );
    expect(deleteRes.ok).toBe(true);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);

    // Verify screenshot is gone from task
    const listRes = await fetch("http://localhost:3764/api/tasks");
    const listData = await listRes.json();
    expect(listData.tasks[0].screenshot).toBeUndefined();
  });

  it("DELETE /api/tasks/:id/screenshot returns 404 for non-existent task", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3765, open: false });

    const res = await fetch("http://localhost:3765/api/tasks/no-such-task/screenshot", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/tasks/:id/screenshot uploads a screenshot", async () => {
    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, SAMPLE_HTML, "utf-8");

    instance = await serve(filePath, { port: 3766, open: false });

    const createRes = await fetch("http://localhost:3766/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Task to screenshot",
        selector: '[data-proto-id="hero-section"]',
      }),
    });
    const { task } = await createRes.json();

    const uploadRes = await fetch(
      `http://localhost:3766/api/tasks/${task.id}/screenshot`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenshot:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        }),
      },
    );
    expect(uploadRes.ok).toBe(true);
    const uploadData = await uploadRes.json();
    expect(uploadData.success).toBe(true);
    expect(uploadData.screenshot).toBe(`${task.id}.png`);
  });
});

// ── API-only mode (no target / existing hosted project) ───────────────────
describe("proto serve — API-only mode (no target)", () => {
  let instance: ServeInstance | null = null;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-api-only-"));
  });

  afterEach(async () => {
    if (instance) {
      await instance.close();
      instance = null;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("starts without a target and serves the task API", async () => {
    // Pass undefined explicitly; serve resolves projectDir from process.cwd()
    // We override cwd for this test by using the overloaded serve with the
    // internal serveApiOnly path — the public API accepts undefined.
    instance = await serve(undefined, { port: 3780, open: false });
    expect(instance.url).toBe("http://localhost:3780");

    const res = await fetch("http://localhost:3780/api/tasks");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.tasks)).toBe(true);
  });

  it("API-only mode: creates and retrieves tasks", async () => {
    instance = await serve(undefined, { port: 3781, open: false });

    const createRes = await fetch("http://localhost:3781/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "API-only task",
        selector: '[data-testid="submit-btn"]',
        url: "http://localhost:5173/checkout",
      }),
    });
    const result = await createRes.json();
    expect(result.success).toBe(true);
    expect(result.task.title).toBe("API-only task");
    expect(result.task.url).toBe("http://localhost:5173/checkout");
  });

  it("API-only mode: does not serve HTML (/ returns 404)", async () => {
    instance = await serve(undefined, { port: 3782, open: false });

    const res = await fetch("http://localhost:3782/");
    expect(res.status).toBe(404);
  });

  it("API-only mode: PATCH updates task status", async () => {
    instance = await serve(undefined, { port: 3783, open: false });

    const createRes = await fetch("http://localhost:3783/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Status test",
        selector: '[data-testid="nav-home"]',
      }),
    });
    const { task } = await createRes.json();

    const patchRes = await fetch(`http://localhost:3783/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    const patchData = await patchRes.json();
    expect(patchData.success).toBe(true);
    expect(patchData.task.status).toBe("done");
  });

  it("API-only mode: DELETE removes a task", async () => {
    instance = await serve(undefined, { port: 3784, open: false });

    const createRes = await fetch("http://localhost:3784/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Delete me",
        selector: '[data-testid="delete-btn"]',
      }),
    });
    const { task } = await createRes.json();

    const deleteRes = await fetch(`http://localhost:3784/api/tasks/${task.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.ok).toBe(true);

    const listRes = await fetch("http://localhost:3784/api/tasks");
    const listData = await listRes.json();
    expect(listData.tasks.every((t: { id: string }) => t.id !== task.id)).toBe(true);
  });

  it("API-only mode: creates .proto dirs in process.cwd()", async () => {
    instance = await serve(undefined, { port: 3785, open: false });

    const { existsSync } = await import("node:fs");
    expect(existsSync(join(process.cwd(), ".proto", "tasks"))).toBe(true);
  });
});

// ── Proxy mode (target is a URL of an existing hosted app) ────────────────
describe("proto serve — proxy mode (URL target)", () => {
  let proxyInstance: ServeInstance | null = null;
  let upstreamServer: ReturnType<typeof createServer> | null = null;

  function startUpstream(port: number, html: string, extraHeaders: Record<string, string> = {}): Promise<void> {
    return new Promise((resolve) => {
      upstreamServer = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html", ...extraHeaders });
        res.end(html);
      });
      upstreamServer!.listen(port, resolve);
    });
  }

  afterEach(async () => {
    if (proxyInstance) { await proxyInstance.close(); proxyInstance = null; }
    if (upstreamServer) await new Promise<void>((r) => upstreamServer!.close(() => r()));
    upstreamServer = null;
  });

  it("proxy mode: injects overlay into upstream HTML", async () => {
    const html = `<!DOCTYPE html><html><body><h1 id="title">My App</h1></body></html>`;
    await startUpstream(9701, html);

    proxyInstance = await serve("http://localhost:9701", { port: 9700, open: false });
    expect(proxyInstance.url).toBe("http://localhost:9700");

    const res = await fetch("http://localhost:9700/");
    expect(res.ok).toBe(true);
    const body = await res.text();
    expect(body).toContain("My App");
    expect(body).toContain("proto-studio-root");
    expect(body).toContain("ws://localhost:9700");
  });

  it("proxy mode: /api/tasks is served by Proto Studio (not proxied)", async () => {
    const html = `<!DOCTYPE html><html><body></body></html>`;
    await startUpstream(9703, html);

    proxyInstance = await serve("http://localhost:9703", { port: 9702, open: false });

    const res = await fetch("http://localhost:9702/api/tasks");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.tasks)).toBe(true);
  });

  it("proxy mode: task creation works (CORS from other origin)", async () => {
    const html = `<!DOCTYPE html><html><body></body></html>`;
    await startUpstream(9705, html);

    proxyInstance = await serve("http://localhost:9705", { port: 9704, open: false });

    const res = await fetch("http://localhost:9704/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Proxy task", selector: "#title" }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.task.title).toBe("Proxy task");
  });

  it("proxy mode: non-HTML responses (JS, CSS) are proxied without modification", async () => {
    const jsContent = "console.log('hello world')";
    upstreamServer = createServer((req, res) => {
      if (req.url === "/app.js") {
        res.writeHead(200, { "content-type": "application/javascript" });
        res.end(jsContent);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((r) => upstreamServer!.listen(9707, r));

    proxyInstance = await serve("http://localhost:9707", { port: 9706, open: false });

    const res = await fetch("http://localhost:9706/app.js");
    expect(res.ok).toBe(true);
    const body = await res.text();
    expect(body).toBe(jsContent);
    // No overlay injection in JS files
    expect(body).not.toContain("proto-studio-root");
  });

  it("proxy mode: strips Content-Security-Policy header from upstream", async () => {
    const html = `<!DOCTYPE html><html><body><p>Secure</p></body></html>`;
    await startUpstream(9709, html, {
      "content-security-policy": "default-src 'self'; script-src 'self'",
    });

    proxyInstance = await serve("http://localhost:9709", { port: 9708, open: false });

    const res = await fetch("http://localhost:9708/");
    expect(res.headers.get("content-security-policy")).toBeNull();
    const body = await res.text();
    expect(body).toContain("proto-studio-root");
  });

  it("proxy mode: /proto-overlay.js returns the overlay script", async () => {
    const html = `<!DOCTYPE html><html><body></body></html>`;
    await startUpstream(9711, html);

    proxyInstance = await serve("http://localhost:9711", { port: 9710, open: false });

    const res = await fetch("http://localhost:9710/proto-overlay.js");
    expect(res.ok).toBe(true);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("javascript");
    const body = await res.text();
    expect(body).toContain("proto-studio-root");
    expect(body).toContain("ws://localhost:9710");
  });

  it("proxy mode: returns 502 when upstream is not running", async () => {
    // No upstream server started on port 9713
    proxyInstance = await serve("http://localhost:9713", { port: 9712, open: false });

    const res = await fetch("http://localhost:9712/");
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toContain("9713");
  });

  it("proxy mode: CORS OPTIONS preflight returns 204", async () => {
    const html = `<!DOCTYPE html><html><body></body></html>`;
    await startUpstream(9715, html);

    proxyInstance = await serve("http://localhost:9715", { port: 9714, open: false });

    const res = await fetch("http://localhost:9714/api/tasks", {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:9715",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

/**
 * E2E tests for the Proto Studio Chrome Extension.
 * Exercises the content-script overlay injected via the Chrome extension
 * into arbitrary web pages.
 *
 * Prerequisites: `npm run build` must have been run first to produce
 *   dist/chrome-extension/  (background.js, content-script.js, manifest.json …)
 *
 * Chrome extensions require launchPersistentContext + --load-extension flag.
 * Playwright 1.21+ bundles a Chromium that supports extensions in headless mode.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { serve } from "../../src/server/server.js";
import type { ServeInstance } from "../../src/server/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const EXT_DIR    = join(__dirname, "../../dist/chrome-extension");
const PORT       = 3700; // matches content-script DEFAULT_PORT — no service worker config needed
const BASE       = `http://localhost:${PORT}`;

const TEST_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Extension Test Page</title>
  <style>
    body { font-family: sans-serif; padding: 32px; background: #f8fafc; }
    nav, main, button, section { margin: 8px 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
  </style>
</head>
<body>
  <nav   data-proto-id="main-nav">Main Navigation</nav>
  <main  data-proto-id="main-content">
    <h1  data-proto-id="hero-title">Extension Test Prototype</h1>
    <button data-proto-id="cta-button">Primary Action</button>
    <section data-proto-id="features-section">
      <h2 data-proto-id="features-title">Features</h2>
      <button data-proto-id="submit-btn">Submit</button>
    </section>
  </main>
</body>
</html>`;

// ── Shadow DOM helpers (same as overlay.test.ts) ─────────────────────────────
async function shadowExists(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((s) => {
    const host = document.querySelector("#proto-studio-root") as HTMLElement;
    return !!(host?.shadowRoot?.querySelector(s));
  }, sel);
}

async function shadowText(page: Page, sel: string): Promise<string> {
  return page.evaluate((s) => {
    const host = document.querySelector("#proto-studio-root") as HTMLElement;
    return host?.shadowRoot?.querySelector(s)?.textContent ?? "";
  }, sel);
}

async function shadowClick(page: Page, sel: string): Promise<void> {
  await page.evaluate((s) => {
    const host = document.querySelector("#proto-studio-root") as HTMLElement;
    (host?.shadowRoot?.querySelector(s) as HTMLElement)?.click();
  }, sel);
}

async function shadowSetValue(page: Page, sel: string, value: string): Promise<void> {
  await page.evaluate(
    ([s, v]) => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      const el = host?.shadowRoot?.querySelector(s) as HTMLInputElement;
      if (el) {
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    [sel, value],
  );
}

async function waitForShadowRoot(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () => !!(document.querySelector("#proto-studio-root") as HTMLElement)?.shadowRoot,
    null,
    { timeout },
  );
}

// ── Test suite ───────────────────────────────────────────────────────────────
const shouldSkip = !existsSync(EXT_DIR) || !existsSync(join(EXT_DIR, "manifest.json"));

describe.skipIf(shouldSkip)("Chrome Extension — content-script overlay", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let instance: ServeInstance;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-ext-pw-"));
    writeFileSync(join(tempDir, "index.html"), TEST_HTML, "utf-8");

    instance = await serve(join(tempDir, "index.html"), { port: PORT, open: false, noOverlay: true });

    // Playwright headless Chromium doesn't run extension content-scripts — use
    // addInitScript to inject the built content-script.js before page load.
    // This tests the overlay JavaScript behaviour without needing the Chrome
    // extension loading mechanism, which only works in headed (non-CI) mode.
    const contentScriptJs = readFileSync(join(EXT_DIR, "content-script.js"), "utf-8");

    context = await chromium.launch({ headless: true }).then((b) => { browser = b; return b.newContext(); });

    // Inject a minimal chrome API stub so getConfig() resolves with the test port.
    await context.addInitScript({
      content: `
        window.chrome = {
          storage: { local: { get: (_key, cb) => cb({ "proto-studio-config": { port: ${PORT}, enabled: true } }) } },
          runtime: {
            sendMessage: (_msg, cb) => { if (cb) cb({ port: ${PORT}, enabled: true }); },
            onMessage: { addListener: () => {} },
          },
        };
      `,
    });
    // Run after DOMContentLoaded so document.body is available for overlay injection.
    await context.addInitScript({
      content: `document.addEventListener('DOMContentLoaded', function() { ${contentScriptJs} }, { once: true });`,
    });

    page = await context.newPage();
    await page.goto(BASE);
    await waitForShadowRoot(page);
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
    await instance?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Mount & identity ────────────────────────────────────────────────────
  it("mounts #proto-studio-root with open shadow DOM", async () => {
    const mode = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.mode;
    });
    expect(mode).toBe("open");
  });

  it("marks the host element as extension-injected", async () => {
    const src = await page.evaluate(() =>
      document.querySelector("#proto-studio-root")?.getAttribute("data-proto-source"),
    );
    expect(src).toBe("extension");
  });

  it("renders the status bar inside the shadow root", async () => {
    expect(await shadowExists(page, ".proto-status")).toBe(true);
  });

  it("status bar shows keyboard hints", async () => {
    const text = await shadowText(page, ".proto-status");
    expect(text).toContain("Proto Studio");
    expect(text).toContain("Alt+A");
    expect(text).toContain("Alt+S");
  });

  // ── Non-interference guard ───────────────────────────────────────────────
  it("does NOT inject a second overlay when root already exists", async () => {
    const count = await page.evaluate(() =>
      document.querySelectorAll("#proto-studio-root").length,
    );
    expect(count).toBe(1);
  });

  // ── Annotation mode ─────────────────────────────────────────────────────
  it("Alt+A enables annotation mode and adds class to body", async () => {
    await page.keyboard.press("Alt+a");
    const active = await page.evaluate(() =>
      document.body.classList.contains("proto-overlay-active"),
    );
    expect(active).toBe(true);
  });

  it("status bar reflects annotation mode", async () => {
    const text = await shadowText(page, ".proto-status");
    expect(text).toContain("Annotation Mode");
  });

  // ── Popover behaviour ────────────────────────────────────────────────────
  it("clicking a [data-proto-id] element opens the annotation popover", async () => {
    await page.click('[data-proto-id="cta-button"]');
    expect(await shadowExists(page, ".proto-popover")).toBe(true);
  });

  it("popover label identifies the clicked element", async () => {
    const text = await shadowText(page, ".popover-label");
    expect(text).toContain("cta-button");
  });

  it("popover has title input, tag select, and textarea", async () => {
    expect(await shadowExists(page, ".proto-popover input[type='text']")).toBe(true);
    expect(await shadowExists(page, ".proto-popover select")).toBe(true);
    expect(await shadowExists(page, ".proto-popover textarea")).toBe(true);
  });

  it("popover tag select has all 6 annotation tags", async () => {
    const options = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      const sel = host?.shadowRoot?.querySelector(".proto-popover select") as HTMLSelectElement;
      return Array.from(sel?.options ?? []).map((o) => o.value);
    });
    expect(options).toEqual(["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"]);
  });

  it("popover has '📷 Capture Area' screenshot button", async () => {
    const text = await shadowText(page, ".popover-actions");
    expect(text).toContain("Capture Area");
  });

  it("Escape dismisses the open popover", async () => {
    await page.keyboard.press("Escape");
    expect(await shadowExists(page, ".proto-popover")).toBe(false);
  });

  it("Escape deactivates annotation mode", async () => {
    await page.keyboard.press("Escape");
    const active = await page.evaluate(() =>
      document.body.classList.contains("proto-overlay-active"),
    );
    expect(active).toBe(false);
  });

  // ── Context menu ─────────────────────────────────────────────────────────
  it("right-click on [data-proto-id] shows the Proto Studio context menu", async () => {
    await page.click('[data-proto-id="features-section"]', { button: "right" });
    expect(await shadowExists(page, ".proto-context-menu")).toBe(true);
  });

  it("context menu contains annotation tag options", async () => {
    const text = await shadowText(page, ".proto-context-menu");
    expect(text).toContain("TODO");
    expect(text).toContain("FEATURE");
  });

  it("clicking the status bar closes the context menu", async () => {
    // The Escape key closes the context menu (reliable vs shadow DOM click event propagation)
    await page.keyboard.press("Escape");
    expect(await shadowExists(page, ".proto-context-menu")).toBe(false);
  });

  // ── Sidebar ──────────────────────────────────────────────────────────────
  it("Alt+S opens the task sidebar", async () => {
    await page.keyboard.press("Alt+s");
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(true);
  });

  it("sidebar heading shows task count", async () => {
    const text = await shadowText(page, ".proto-sidebar h3");
    expect(text).toMatch(/Tasks \(\d+\/\d+\)/);
  });

  it("Escape closes the sidebar", async () => {
    await page.keyboard.press("Escape");
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(false);
  });

  // ── Task submission flow ─────────────────────────────────────────────────
  it("submitting an annotation task shows saved feedback", async () => {
    await page.keyboard.press("Alt+a");
    await page.click('[data-proto-id="hero-title"]');

    await shadowSetValue(page, ".proto-popover input[type='text']", "Extension test task");
    await shadowSetValue(page, ".proto-popover textarea", "Submitted from extension e2e test");
    await shadowClick(page, ".btn-primary");

    await page.waitForFunction(
      () => {
        const host = document.querySelector("#proto-studio-root") as HTMLElement;
        return host?.shadowRoot?.querySelector(".proto-status")?.textContent?.includes("saved");
      },
      null,
      { timeout: 5_000 },
    );

    const text = await shadowText(page, ".proto-status");
    expect(text).toContain("saved");
    // Exit annotation mode so subsequent tests start from a clean state
    await page.keyboard.press("Escape");
  });

  it("submitted task appears in the sidebar", async () => {
    await page.keyboard.press("Alt+s");
    await page.waitForFunction(
      () => {
        const host = document.querySelector("#proto-studio-root") as HTMLElement;
        return !!(host?.shadowRoot?.querySelector(".task-card"));
      },
      null,
      { timeout: 10_000 },
    );
    expect(await shadowExists(page, ".task-card")).toBe(true);
  });

  it("sidebar task card shows correct title", async () => {
    const titleText = await shadowText(page, ".task-title");
    expect(titleText).toContain("Extension test task");
  });

  it("marking a task done updates the sidebar", async () => {
    await shadowClick(page, ".done-btn");
    await page.waitForFunction(
      () => {
        const host = document.querySelector("#proto-studio-root") as HTMLElement;
        return !!(host?.shadowRoot?.querySelector(".status-done"));
      },
      null,
      { timeout: 5_000 },
    );
    expect(await shadowExists(page, ".status-done")).toBe(true);
  });

  // ── No popover outside annotation mode ───────────────────────────────────
  it("clicking [data-proto-id] outside annotation mode does NOT open popover", async () => {
    const active = await page.evaluate(() =>
      document.body.classList.contains("proto-overlay-active"),
    );
    expect(active).toBe(false);

    await page.click('[data-proto-id="cta-button"]');
    expect(await shadowExists(page, ".proto-popover")).toBe(false);
  });
});


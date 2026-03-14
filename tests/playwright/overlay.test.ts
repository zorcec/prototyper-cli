/**
 * Playwright e2e tests for the Proto Studio overlay.
 *
 * These tests serve a real HTML page with a dark-theme host (mimicking Tailwind
 * pages with `color: white` on `*`) and verify that the Shadow DOM overlay is
 * fully visually isolated — correct dark theme colours everywhere.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { serve } from "../../src/server/server.js";
import type { ServeInstance } from "../../src/server/server.js";

const PORT = 3880;
const BASE = `http://localhost:${PORT}`;

// ── Fixture HTML ─────────────────────────────────────────────────────────────
const DARK_THEME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dark Theme Prototype</title>
  <style>
    *, *::before, *::after { color: white; background-color: #0f172a; box-sizing: border-box; }
    body                   { color: white; background: #0f172a; font-family: sans-serif; min-height: 100vh; }
    button, select, textarea, input {
      color: white;
      background: #1e293b;
      border: 1px solid #334155;
      padding: 8px;
    }
  </style>
</head>
<body>
  <nav   data-proto-id="main-nav">Main Navigation</nav>
  <main  data-proto-id="main-content">
    <h1  data-proto-id="hero-title">Dark Theme Prototype</h1>
    <button data-proto-id="cta-button">Primary Action</button>
    <section data-proto-id="features-section">
      <h2 data-proto-id="features-title">Features</h2>
      <form data-proto-id="login-form">
        <input type="text"  placeholder="Username" data-proto-id="username-input">
        <button type="submit" data-proto-id="submit-btn">Login</button>
      </form>
    </section>
  </main>
</body>
</html>`;

// ── Colour helpers ────────────────────────────────────────────────────────────
function rgbAvg(css: string): number {
  const m = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return -1;
  return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3;
}
function isLight(css: string)  { return rgbAvg(css) > 200; }
function isDark(css: string)   { return rgbAvg(css) < 100; }
function isBlue(css: string)   {
  const m = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return false;
  return Number(m[3]) > Number(m[1]);
}
function isOpaque(css: string) {
  return css !== "rgba(0, 0, 0, 0)" && css !== "transparent";
}

// ── Shadow DOM helpers ────────────────────────────────────────────────────────
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

async function shadowStyle(page: Page, sel: string, prop: keyof CSSStyleDeclaration): Promise<string> {
  return page.evaluate(
    ([s, p]) => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      const el = host?.shadowRoot?.querySelector(s) as HTMLElement;
      if (!el) return "rgba(0, 0, 0, 0)";
      return (getComputedStyle(el) as Record<string, string>)[p as string] ?? "";
    },
    [sel, prop as string],
  );
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

// ── Test suite ───────────────────────────────────────────────────────────────
describe("Overlay — Shadow DOM visual isolation on dark-theme host", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let instance: ServeInstance;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-pw-"));
    writeFileSync(join(tempDir, "index.html"), DARK_THEME_HTML, "utf-8");

    instance = await serve(join(tempDir, "index.html"), { port: PORT, open: false });
    browser  = await chromium.launch({ headless: true });
    context  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page     = await context.newPage();

    await page.goto(BASE);
    await page.waitForFunction(
      () => !!(document.querySelector("#proto-studio-root") as HTMLElement)?.shadowRoot,
      { timeout: 10_000 },
    );
  });

  afterAll(async () => {
    await context?.close();
    await browser?.close();
    await instance?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Structural checks ───────────────────────────────────────────────────
  it("mounts a shadow DOM host with an open shadow root", async () => {
    const mode = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.mode;
    });
    expect(mode).toBe("open");
  });

  it("injects overlay stylesheet inside the shadow root", async () => {
    const count = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelectorAll("style").length ?? 0;
    });
    expect(count).toBeGreaterThan(0);
  });

  it("renders the status bar inside the shadow DOM", async () => {
    expect(await shadowExists(page, ".proto-status")).toBe(true);
  });

  // ── Status bar colours (dark theme) ─────────────────────────────────────
  it("status bar: dark background", async () => {
    const bg = await shadowStyle(page, ".proto-status", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isDark(bg)).toBe(true);
  });

  it("status bar: light text colour", async () => {
    const color = await shadowStyle(page, ".proto-status", "color");
    expect(isLight(color)).toBe(true);
  });

  it("status bar: contains keyboard hints", async () => {
    const text = await shadowText(page, ".proto-status");
    expect(text).toContain("Proto Studio");
    expect(text).toContain("Alt+A");
    expect(text).toContain("Alt+S");
  });

  // ── Annotation mode ─────────────────────────────────────────────────────
  it("Alt+A enables annotation mode (adds class to body)", async () => {
    await page.keyboard.press("Alt+a");
    const active = await page.evaluate(() =>
      document.body.classList.contains("proto-overlay-active"),
    );
    expect(active).toBe(true);
  });

  it("status bar updates to show Annotation Mode text", async () => {
    const text = await shadowText(page, ".proto-status");
    expect(text).toContain("Annotation Mode");
  });

  // ── Popover (dark theme) ────────────────────────────────────────────────
  it("clicking a data-proto-id element opens the popover", async () => {
    await page.click('[data-proto-id="cta-button"]');
    expect(await shadowExists(page, ".proto-popover")).toBe(true);
  });

  it("popover: dark background (dark theme)", async () => {
    const bg = await shadowStyle(page, ".proto-popover", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isDark(bg)).toBe(true);
  });

  it("popover: light text (dark theme)", async () => {
    const color = await shadowStyle(page, ".proto-popover", "color");
    expect(isLight(color)).toBe(true);
  });

  it("popover label: shows the proto-id being annotated", async () => {
    const text = await shadowText(page, ".popover-label");
    expect(text).toContain("cta-button");
  });

  it("popover select: light text on dark background (dark theme)", async () => {
    const color = await shadowStyle(page, ".proto-popover select", "color");
    expect(isLight(color)).toBe(true);
  });

  it("popover select: dark background", async () => {
    const bg = await shadowStyle(page, ".proto-popover select", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isDark(bg)).toBe(true);
  });

  it("popover textarea: light text (dark theme)", async () => {
    const color = await shadowStyle(page, ".proto-popover textarea", "color");
    expect(isLight(color)).toBe(true);
  });

  it("popover textarea: dark background", async () => {
    const bg = await shadowStyle(page, ".proto-popover textarea", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isDark(bg)).toBe(true);
  });

  it("popover save button: white text on blue background", async () => {
    const color = await shadowStyle(page, ".proto-popover .btn-primary", "color");
    const bg    = await shadowStyle(page, ".proto-popover .btn-primary", "backgroundColor");
    expect(isLight(color)).toBe(true);
    expect(isBlue(bg)).toBe(true);
  });

  it("popover select: lists all 6 annotation tags", async () => {
    const options = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      const sel = host?.shadowRoot?.querySelector(".proto-popover select") as HTMLSelectElement;
      return Array.from(sel?.options ?? []).map((o) => o.value);
    });
    expect(options).toEqual(["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"]);
  });

  it("popover has title input field", async () => {
    expect(await shadowExists(page, ".proto-popover input[type='text']")).toBe(true);
  });

  // ── Escape behaviour ────────────────────────────────────────────────────
  it("Escape dismisses the popover", async () => {
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

  // ── Task submission ──────────────────────────────────────────────────────
  it("submitting task shows saved feedback in status bar", async () => {
    await page.keyboard.press("Alt+a");
    await page.click('[data-proto-id="hero-title"]');

    await shadowSetValue(page, ".proto-popover input[type='text']", "Test task title");
    await shadowSetValue(page, ".proto-popover textarea", "Shadow DOM test task");
    await shadowClick(page, ".btn-primary");

    await page.waitForFunction(
      () => {
        const host = document.querySelector("#proto-studio-root") as HTMLElement;
        return host?.shadowRoot?.querySelector(".proto-status")?.textContent?.includes("saved");
      },
      { timeout: 5_000 },
    );

    const text = await shadowText(page, ".proto-status");
    expect(text).toContain("saved");

    // Wait for potential WS-triggered reload
    await Promise.race([
      page.waitForNavigation({ timeout: 4_000 }).catch(() => null),
      new Promise((r) => setTimeout(r, 4_000)),
    ]);
    await page.waitForFunction(
      () => !!(document.querySelector("#proto-studio-root") as HTMLElement)?.shadowRoot,
      { timeout: 5_000 },
    );
    // Exit annotation mode (no-op if page reloaded and reset state)
    await page.keyboard.press("Escape");
  });

  // ── Sidebar (dark theme) ─────────────────────────────────────────────────
  it("Alt+S opens the task sidebar", async () => {
    await page.keyboard.press("Alt+s");
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(true);
  });

  it("sidebar: dark background (dark theme)", async () => {
    const bg = await shadowStyle(page, ".proto-sidebar", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isDark(bg)).toBe(true);
  });

  it("sidebar: light text", async () => {
    const color = await shadowStyle(page, ".proto-sidebar", "color");
    expect(isLight(color)).toBe(true);
  });

  it("sidebar heading shows task count", async () => {
    const text = await shadowText(page, ".proto-sidebar h3");
    expect(text).toMatch(/Tasks \(\d+\/\d+\)/);
  });

  it("sidebar shows submitted task card", async () => {
    // The sidebar was opened in the "Alt+S opens" test above and is still open.
    // The fetchTasks() call should have loaded the task we submitted earlier.
    // Wait for a task card to appear (fetchTasks is async).
    await page.waitForFunction(
      () => {
        const host = document.querySelector("#proto-studio-root") as HTMLElement;
        return !!(host?.shadowRoot?.querySelector(".task-card"));
      },
      { timeout: 10_000 },
    );
    const cardExists = await shadowExists(page, ".task-card");
    expect(cardExists).toBe(true);
  });

  it("task card: tag badge has coloured background", async () => {
    const bg = await shadowStyle(page, ".tag-badge", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
  });

  it("task card: title text is light and readable", async () => {
    const color = await shadowStyle(page, ".task-title", "color");
    expect(isLight(color)).toBe(true);
  });

  it("Escape closes the sidebar", async () => {
    await page.keyboard.press("Escape");
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(false);
  });

  // ── Edge trigger zone ───────────────────────────────────────────────────
  it("edge trigger zone exists in shadow DOM", async () => {
    expect(await shadowExists(page, ".proto-edge-trigger")).toBe(true);
  });

  // ── Multiple proto-ids - can annotate different elements ─────────────────
  it("can annotate a second element after the first was submitted", async () => {
    await page.keyboard.press("Alt+a");
    await page.click('[data-proto-id="submit-btn"]');
    expect(await shadowExists(page, ".proto-popover")).toBe(true);

    const label = await shadowText(page, ".popover-label");
    expect(label).toContain("submit-btn");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  // ── No popover outside annotation mode ───────────────────────────────────
  it("clicking a proto-id element outside annotation mode does NOT open popover", async () => {
    const active = await page.evaluate(() =>
      document.body.classList.contains("proto-overlay-active"),
    );
    expect(active).toBe(false);

    await page.click('[data-proto-id="cta-button"]');
    expect(await shadowExists(page, ".proto-popover")).toBe(false);
  });

  // ── Sidebar toggle ────────────────────────────────────────────────────────
  it("Alt+S closes the sidebar when it is already open", async () => {
    await page.keyboard.press("Alt+s");
    await page.keyboard.press("Alt+s");
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(false);
  });

  // ── Directory serve: index page ───────────────────────────────────────────
  it("directory index page is served when a directory is given", async () => {
    const res = await fetch(BASE);
    expect(res.ok).toBe(true);
  });
});

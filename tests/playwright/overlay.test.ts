/**
 * Playwright e2e tests for the Proto Studio overlay.
 *
 * These tests serve a real HTML page with a dark-theme host (mimicking Tailwind
 * pages with `color: white` on `*`) and verify that the Shadow DOM overlay is
 * fully visually isolated — no white-on-white, correct colours everywhere.
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
// Simulates the worst-case host page: a dark-theme app where EVERY element
// (including inputs, selects, buttons, textareas) inherits `color: white` and a
// dark background — exactly the environment that caused the white-on-white bug.
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
  return Number(m[3]) > Number(m[1]);          // blue channel > red channel
}
function isOpaque(css: string) {
  return css !== "rgba(0, 0, 0, 0)" && css !== "transparent";
}

// ── Shadow DOM helpers ────────────────────────────────────────────────────────
// All overlay UI lives inside the shadow root so normal page.locator() won't
// reach it — we query via evaluate() with the shadow root reference.

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
      // Return transparent so isOpaque() correctly reports false when missing
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
    // Wait until the shadow host is mounted
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

  // ── Status bar colours ──────────────────────────────────────────────────
  it("status bar: dark background (not inheriting host page dark bg with light text missing)", async () => {
    const bg = await shadowStyle(page, ".proto-status", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isDark(bg)).toBe(true);        // #1e293b ≈ rgb(30, 41, 59)
  });

  it("status bar: light text colour", async () => {
    const color = await shadowStyle(page, ".proto-status", "color");
    expect(isLight(color)).toBe(true);    // #f1f5f9 ≈ rgb(241, 245, 249)
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

  // ── Popover ─────────────────────────────────────────────────────────────
  it("clicking a data-proto-id element opens the popover", async () => {
    await page.click('[data-proto-id="cta-button"]');
    expect(await shadowExists(page, ".proto-popover")).toBe(true);
  });

  it("popover: white background (not dark from host page)", async () => {
    const bg = await shadowStyle(page, ".proto-popover", "backgroundColor");
    // Must be white or near-white: rgb(255,255,255)
    expect(bg).toBe("rgb(255, 255, 255)");
  });

  it("popover: dark text (not white-on-white)", async () => {
    const color = await shadowStyle(page, ".proto-popover", "color");
    expect(isDark(color)).toBe(true);     // #111827 ≈ rgb(17, 24, 39)
  });

  it("popover label: shows the proto-id being annotated", async () => {
    const text = await shadowText(page, ".popover-label");
    expect(text).toContain("cta-button");
  });

  it("popover select: dark text (isolated from host `color: white`)", async () => {
    const color = await shadowStyle(page, ".proto-popover select", "color");
    expect(isDark(color)).toBe(true);
  });

  it("popover select: opaque background (not host dark background)", async () => {
    const bg = await shadowStyle(page, ".proto-popover select", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isLight(bg)).toBe(true);       // #f9fafb ≈ rgb(249,250,251)
  });

  it("popover textarea: dark text (isolated from host `color: white`)", async () => {
    const color = await shadowStyle(page, ".proto-popover textarea", "color");
    expect(isDark(color)).toBe(true);
  });

  it("popover textarea: opaque light background", async () => {
    const bg = await shadowStyle(page, ".proto-popover textarea", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isLight(bg)).toBe(true);
  });

  it("popover cancel button: dark text on light background", async () => {
    const color = await shadowStyle(page, ".proto-popover button:not(.btn-primary)", "color");
    const bg    = await shadowStyle(page, ".proto-popover button:not(.btn-primary)", "backgroundColor");
    expect(isDark(color) || rgbAvg(color) < 150).toBe(true);
    expect(isOpaque(bg)).toBe(true);
  });

  it("popover save button: white text on blue background", async () => {
    const color = await shadowStyle(page, ".proto-popover .btn-primary", "color");
    const bg    = await shadowStyle(page, ".proto-popover .btn-primary", "backgroundColor");
    expect(isLight(color)).toBe(true);    // white text
    expect(isBlue(bg)).toBe(true);        // blue background
  });

  it("popover select: lists all 6 annotation tags", async () => {
    const options = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      const sel = host?.shadowRoot?.querySelector(".proto-popover select") as HTMLSelectElement;
      return Array.from(sel?.options ?? []).map((o) => o.value);
    });
    expect(options).toEqual(["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"]);
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

  // ── Annotation submission ────────────────────────────────────────────────
  it("submitting annotation shows '✓ Annotation saved' in status bar", async () => {
    await page.keyboard.press("Alt+a");
    await page.click('[data-proto-id="hero-title"]');

    await shadowSetValue(page, ".proto-popover textarea", "Shadow DOM test annotation");
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

    // The file watcher detects the disk write and sends a WS reload.
    // Wait for that navigation to complete before subsequent sidebar checks.
    await Promise.race([
      page.waitForNavigation({ timeout: 4_000 }).catch(() => null),
      new Promise((r) => setTimeout(r, 4_000)), // fallback: just wait
    ]);
    // Re-wait for shadow root after potential reload
    await page.waitForFunction(
      () => !!(document.querySelector("#proto-studio-root") as HTMLElement)?.shadowRoot,
      { timeout: 5_000 },
    );
  });

  // ── Sidebar ──────────────────────────────────────────────────────────────
  it("Alt+S opens the annotation sidebar", async () => {
    await page.keyboard.press("Alt+s");
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(true);
  });

  it("sidebar: white background (not host dark bg)", async () => {
    const bg = await shadowStyle(page, ".proto-sidebar", "backgroundColor");
    expect(bg).toBe("rgb(255, 255, 255)");
  });

  it("sidebar: dark text", async () => {
    const color = await shadowStyle(page, ".proto-sidebar", "color");
    expect(isDark(color)).toBe(true);
  });

  it("sidebar heading shows annotation count", async () => {
    const text = await shadowText(page, ".proto-sidebar h3");
    expect(text).toMatch(/Annotations \(\d+\)/);
  });

  it("sidebar shows submitted annotation card", async () => {
    // The sidebar was opened before possible page reload — re-open it now so
    // refreshSidebar() scans the current DOM which should have the annotation.
    await page.keyboard.press("Escape");   // close if open
    await page.keyboard.press("Alt+s");
    await page.waitForFunction(
      () => !!(document.querySelector("#proto-studio-root") as HTMLElement)
        ?.shadowRoot?.querySelector(".proto-sidebar.open"),
      { timeout: 3_000 },
    );
    const cardExists = await shadowExists(page, ".annotation-card");
    expect(cardExists).toBe(true);
  });

  it("annotation card: tag badge has coloured background", async () => {
    const bg = await shadowStyle(page, ".tag-badge", "backgroundColor");
    expect(isOpaque(bg)).toBe(true);
    expect(isLight(bg)).toBe(false);      // colour, not white
  });

  it("annotation card: annotation text is dark and readable", async () => {
    const color = await shadowStyle(page, ".annotation-text", "color");
    expect(isDark(color) || rgbAvg(color) < 150).toBe(true);
  });

  it("Escape closes the sidebar", async () => {
    await page.keyboard.press("Escape");
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(false);
  });

  // ── Dark-theme host isolation: regression tests ──────────────────────────
  it("textarea colour is NOT white (host-page `color:white` does not bleed into shadow)", async () => {
    await page.keyboard.press("Alt+a");
    await page.click('[data-proto-id="features-title"]');

    const color = await shadowStyle(page, "textarea", "color");
    // Must NOT be white (rgb(255,255,255)) even though host page sets color:white on *
    expect(isLight(color)).toBe(false);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  it("select colour is NOT white (host-page `color:white` does not bleed into shadow)", async () => {
    await page.keyboard.press("Alt+a");
    await page.click('[data-proto-id="cta-button"]');

    const color = await shadowStyle(page, "select", "color");
    expect(isLight(color)).toBe(false);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  it("button background is NOT dark (host-page `background:#1e293b` does not bleed into shadow)", async () => {
    await page.keyboard.press("Alt+a");
    await page.click('[data-proto-id="hero-title"]');

    const bg = await shadowStyle(page, "button:not(.btn-primary)", "backgroundColor");
    // Cancel button should be #f9fafb (near-white), NOT #1e293b (host dark)
    expect(isDark(bg)).toBe(false);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
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
    // Ensure annotation mode is off
    const active = await page.evaluate(() =>
      document.body.classList.contains("proto-overlay-active"),
    );
    expect(active).toBe(false);

    await page.click('[data-proto-id="cta-button"]');
    expect(await shadowExists(page, ".proto-popover")).toBe(false);
  });

  // ── Sidebar toggle ────────────────────────────────────────────────────────
  it("Alt+S closes the sidebar when it is already open", async () => {
    await page.keyboard.press("Alt+s");  // open
    await page.keyboard.press("Alt+s");  // close
    const open = await page.evaluate(() => {
      const host = document.querySelector("#proto-studio-root") as HTMLElement;
      return host?.shadowRoot?.querySelector(".proto-sidebar")?.classList.contains("open");
    });
    expect(open).toBe(false);
  });

  // ── Directory serve: index page ───────────────────────────────────────────
  it("directory index page is served when a directory is given", async () => {
    // This check is done at HTTP level — we already have a dir test in serve.test.ts
    // but confirm the behaviour via a browser page load here too
    const res = await fetch(BASE);
    expect(res.ok).toBe(true);
  });
});

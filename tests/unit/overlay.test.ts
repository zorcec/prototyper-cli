import { describe, it, expect } from "vitest";
import { getOverlayScript } from "../../src/client/overlay.js";

describe("getOverlayScript", () => {
  it("returns a non-empty string", () => {
    const script = getOverlayScript(3700);
    expect(script.length).toBeGreaterThan(100);
  });

  it("includes the correct WebSocket URL with port", () => {
    const script = getOverlayScript(4000);
    expect(script).toContain("ws://localhost:4000");
  });

  it("includes task API URL with port", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("http://localhost:3700/api/tasks");
  });

  it("contains all annotation tags", () => {
    const script = getOverlayScript(3700);
    for (const tag of ["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"]) {
      expect(script).toContain(tag);
    }
  });

  it("includes keyboard shortcut handlers", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("Alt+A");
    expect(script).toContain("Alt+S");
    expect(script).toContain("Escape");
  });

  it("is wrapped in an IIFE", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("(function");
    expect(script).toContain("}()");
  });

  it("uses different port numbers correctly", () => {
    const script8080 = getOverlayScript(8080);
    expect(script8080).toContain("ws://localhost:8080");
    expect(script8080).toContain("http://localhost:8080");
    expect(script8080).not.toContain("localhost:3700");
  });

  it("includes dark theme CSS (#0f172a)", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("#0f172a");
    expect(script).toContain("#1e293b");
  });

  it("includes edge trigger zone for sidebar", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("proto-edge-trigger");
  });

  it("includes sidebar with task cards", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("proto-sidebar");
    expect(script).toContain("task-card");
  });

  it("includes context menu", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("proto-context-menu");
    expect(script).toContain("contextmenu");
  });

  it("includes ping/pong keepalive for stable WS", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("ping");
    expect(script).toContain("pong");
    expect(script).toContain("PING_INTERVAL");
  });

  it("includes exponential backoff reconnection", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("RECONNECT_BASE");
    expect(script).toContain("RECONNECT_MAX");
    expect(script).toContain("scheduleReconnect");
  });

  it("includes conflict guard for Chrome extension", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("proto-studio-root");
  });

  it("includes task indicator rendering", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("renderIndicators");
    expect(script).toContain("proto-task-indicator");
    expect(script).toContain("proto-indicators");
  });

  it("re-renders indicators on scroll and resize", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("scheduleRenderIndicators");
    expect(script).toContain("scroll");
    expect(script).toContain("resize");
  });

  it("includes tooltip for indicator hover", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("showIndicatorTooltip");
    expect(script).toContain("hideIndicatorTooltip");
    expect(script).toContain("proto-task-tooltip");
  });

  it("includes edit task popover", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("showEditPopover");
    expect(script).toContain("Update");
  });

  it("edit popover sends PATCH request with tag, status, title, description", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("PATCH");
    expect(script).toContain("tagSelect.value");
    expect(script).toContain("statusSelect.value");
  });

  it("sidebar task cards have edit buttons", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("edit-btn");
    expect(script).toContain("showEditPopover");
  });

  it("calls renderIndicators after fetchTasks", () => {
    const script = getOverlayScript(3700);
    // renderIndicators should be called inside the fetchTasks then-callback
    const fetchIdx = script.indexOf("function fetchTasks");
    const indicatorIdx = script.indexOf("renderIndicators()", fetchIdx);
    expect(indicatorIdx).toBeGreaterThan(fetchIdx);
  });

  it("includes show/hide indicators toggle with localStorage persistence", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("indicatorsVisible");
    expect(script).toContain("savePrefs");
    expect(script).toContain("PREFS_KEY");
    expect(script).toContain("localStorage");
  });

  it("includes show/hide done tasks toggle", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("sidebarShowDone");
    expect(script).toContain("Show Done");
    expect(script).toContain("sidebar-legend");
    expect(script).toContain("legend-toggle");
  });

  it("includes sticky tooltip on click (tooltipPinned)", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("tooltipPinned");
    expect(script).toContain("forceHideTooltip");
    expect(script).toContain("tooltip-close-btn");
  });

  it("includes screenshot removal in edit popover", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("removeScreenshotBtn");
    expect(script).toContain("remove-screenshot-btn");
    expect(script).toContain("/screenshot");
  });

  it("includes captureArea with Chrome extension API fallback", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("captureArea");
    expect(script).toContain("proto-capture-request");
    expect(script).toContain("proto-capture-response");
    expect(script).toContain("cropFromFullScreenshot");
    expect(script).toContain("captureAreaWithCanvas");
  });

  it("includes click-outside handler to close pinned tooltip", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("composedPath");
    expect(script).toContain("forceHideTooltip");
  });
});

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

  it("contains status badges but no tag badges", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("status-badge");
    expect(script).not.toContain("tag-badge");
    expect(script).not.toContain("TAG_COLORS");
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

  it("includes full-screen edit modal", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("showEditModal");
    expect(script).toContain("modal-tab");
    expect(script).toContain("renderMarkdown");
  });

  it("edit modal sends PATCH request with status, title, description", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("PATCH");
    expect(script).toContain("statusSelect.value");
    expect(script).not.toContain("tagSelect.value");
  });

  it("sidebar task cards have edit buttons", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("edit-btn");
    expect(script).toContain("showEditModal");
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
    expect(script).toContain("Show Done Tasks");
    expect(script).toContain("sidebar-legend");
    expect(script).toContain("legend-toggle");
  });

  it("show done filter triggers renderIndicators (filter applies to both overlay and sidebar)", () => {
    const script = getOverlayScript(3700);
    // The doneToggleBtn click handler must call renderIndicators() before refreshSidebar()
    const doneIdx = script.indexOf("Show Done Tasks");
    const renderIdx = script.indexOf("renderIndicators()", doneIdx);
    const refreshIdx = script.indexOf("refreshSidebar()", doneIdx);
    expect(renderIdx).toBeGreaterThan(doneIdx);
    expect(refreshIdx).toBeGreaterThan(renderIdx);
  });

  it("renderIndicators hides all-done group when sidebarShowDone is false", () => {
    const script = getOverlayScript(3700);
    // Guard: skip all-done indicator when sidebarShowDone is false
    expect(script).toContain("allDone && !sidebarShowDone");
  });

  it("includes sticky tooltip on click (tooltipPinned)", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("tooltipPinned");
    expect(script).toContain("forceHideTooltip");
    expect(script).toContain("tooltip-close-btn");
  });

  it("includes screenshot UI in edit modal", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("buildScreenshotContainer");
    expect(script).toContain("screenshot-container");
    expect(script).toContain("screenshot-remove-overlay");
    expect(script).toContain("modal-screenshot-section");
    expect(script).toContain("/screenshot"); // DELETE /screenshot endpoint
  });

  it("edit modal footer has styled button classes", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("btn-primary");
    expect(script).toContain("btn-ghost");
    expect(script).toContain("btn-screenshot");
    expect(script).toContain("modal-footer-left");
    expect(script).toContain("modal-footer-right");
  });

  it("sidebar filters tasks by current page URL and shows other-pages hint", () => {
    const script = getOverlayScript(3700);
    // refreshSidebar must apply URL filter (same as renderIndicators)
    expect(script).toContain("other-pages-hint");
    expect(script).toContain("otherPagesCount");
    // pageTasks is used for sidebar rendering (not raw `tasks` array)
    const refreshFnIdx = script.indexOf("function refreshSidebar");
    expect(refreshFnIdx).toBeGreaterThan(-1);
    const afterRefresh = script.slice(refreshFnIdx, refreshFnIdx + 600);
    expect(afterRefresh).toContain("pageTasks");
    expect(afterRefresh).toContain("location.pathname");
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

  it("uses buildElementSelector for flexible selector generation", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("buildElementSelector");
    // Falls back through: data-proto-id → data-testid → id → CSS path
    expect(script).toContain("data-testid");
    expect(script).toContain("data-proto-id");
  });

  it("submitTask uses full selector string, not bare protoId", () => {
    const script = getOverlayScript(3700);
    // submitTask first param is selector (a '[attr="id"]' string), not protoId
    expect(script).toContain("submitTask(selector,");
    // selector must not be hardcoded inside submitTask body
    const submitIdx = script.indexOf("function submitTask(selector,");
    const hardcoded = script.indexOf('[data-proto-id="\'', submitIdx);
    expect(hardcoded).toBe(-1);
  });

  it("includes page switcher for variant navigation", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("proto-page-switcher");
    expect(script).toContain("fetchPages");
    expect(script).toContain("PAGES_URL");
    expect(script).toContain("renderPageSwitcher");
  });

  it("filters indicators by current page URL", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("location.pathname");
    expect(script).toContain("pageTasks");
  });

  it("buildElementSelector anchors CSS path to ancestor data-testid", () => {
    const script = getOverlayScript(3700);
    // When traversing ancestors during CSS path build, testid should be preferred
    expect(script).toContain("ancTestId");
    expect(script).toContain("data-testid");
    // css selector as last resort comment
    expect(script).toContain("css selector as last resort");
  });

  it("context menu has single Annotate option (no type options)", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("annotateBtn");
    expect(script).not.toContain("Add TODO");
    expect(script).not.toContain("Add FEATURE");
  });

  it("the compiled overlay script is valid JavaScript (no SyntaxError)", () => {
    // Regression: template-literal escape issues caused /^// and invalid regexes
    // that broke the overlay in the browser with 'Unexpected token ,' or similar.
    const script = getOverlayScript(3700);
    expect(() => new Function(script)).not.toThrow();
  });

  it("renderMarkdown is included and can render basic markdown constructs", () => {
    const script = getOverlayScript(3700);
    // The function must exist
    expect(script).toContain("function renderMarkdown");
    // Must support headings, bold, italic, lists, inline code
    expect(script).toContain("<h1>");
    expect(script).toContain("<strong>");
    expect(script).toContain("<em>");
    expect(script).toContain("<code>");
    expect(script).toContain("<ul>");
  });

  it("edit modal has Edit and Preview tabs", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("modal-tab");
    expect(script).toContain("modal-preview-pane");
    expect(script).toContain("modal-editor-pane");
    expect(script).toContain("Edit");
    expect(script).toContain("Preview");
  });

  it("edit modal supports Escape key to close and Ctrl+Enter to save", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("Escape");
    expect(script).toContain("ctrlKey");
  });

  it("renderIndicators skips elements outside the viewport", () => {
    const script = getOverlayScript(3700);
    // Viewport visibility check must be present in renderIndicators
    expect(script).toContain("vpW");
    expect(script).toContain("vpH");
    expect(script).toContain("rect.bottom < 0");
    expect(script).toContain("rect.top > vpH");
    expect(script).toContain("rect.right < 0");
    expect(script).toContain("rect.left > vpW");
  });

  it("single-task indicator click opens edit modal directly without tooltip", () => {
    const script = getOverlayScript(3700);
    // The click handler must branch on grp.length === 1
    expect(script).toContain("grp.length === 1");
    // Single task: open edit modal directly
    expect(script).toContain("showEditModal(grp[0])");
  });

  it("multi-task indicator click still pins tooltip for selection", () => {
    const script = getOverlayScript(3700);
    // Multi-task branch must still pin tooltip
    const clickIdx = script.indexOf("grp.length === 1");
    expect(clickIdx).toBeGreaterThan(-1);
    // After the single-task branch there must be a tooltipPinned = true
    const afterClick = script.slice(clickIdx, clickIdx + 500);
    expect(afterClick).toContain("tooltipPinned = true");
  });
});

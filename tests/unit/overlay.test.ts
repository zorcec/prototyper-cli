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

  it("includes API URL with port", () => {
    const script = getOverlayScript(3700);
    expect(script).toContain("http://localhost:3700/api/annotate");
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
    expect(script).toContain("(function()");
    expect(script).toContain("})()");
  });

  it("uses different port numbers correctly", () => {
    const script8080 = getOverlayScript(8080);
    expect(script8080).toContain("ws://localhost:8080");
    expect(script8080).toContain("http://localhost:8080");
    expect(script8080).not.toContain("localhost:3700");
  });
});

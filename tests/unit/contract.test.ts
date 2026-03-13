import { describe, it, expect } from "vitest";
import { validateHtml } from "../../src/core/contract.js";

describe("validateHtml", () => {
  const validHtml = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body>
  <div data-proto-id="hero">Hero Section</div>
  <button data-proto-id="cta">Click me</button>
</body></html>`;

  it("passes for valid HTML with proto-ids", () => {
    const result = validateHtml(validHtml);
    expect(result.valid).toBe(true);
    expect(result.stats.elementsWithIds).toBe(2);
    expect(result.issues.filter((i) => i.type === "error")).toHaveLength(0);
  });

  it("reports missing proto-ids from previous version", () => {
    const current = `<div data-proto-id="hero">Hero</div>`;
    const previousIds = ["hero", "cta", "footer"];

    const result = validateHtml(current, previousIds);
    expect(result.valid).toBe(false);
    const errors = result.issues.filter((i) => i.type === "error");
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("cta");
    expect(errors[1].message).toContain("footer");
  });

  it("warns about unresolved TODO annotations", () => {
    const html = `<!-- @TODO[data-proto-id="btn"] Fix this button -->
<button data-proto-id="btn">Click</button>`;

    const result = validateHtml(html);
    expect(result.stats.unresolvedTodos).toBe(1);
    const warnings = result.issues.filter((i) => i.type === "warning");
    expect(warnings.some((w) => w.message.includes("@TODO"))).toBe(true);
  });

  it("warns about unresolved FEATURE annotations", () => {
    const html = `<!-- @FEATURE[data-proto-id="area"] Add tooltip -->
<div data-proto-id="area">Content</div>`;

    const result = validateHtml(html);
    expect(result.stats.unresolvedFeatures).toBe(1);
  });

  it("counts KEEP annotations", () => {
    const html = `<!-- @KEEP[data-proto-id="logo"] Do not touch -->
<img data-proto-id="logo" src="logo.png">`;

    const result = validateHtml(html);
    expect(result.stats.preservedKeeps).toBe(1);
  });

  it("warns about non-CDN external dependencies", () => {
    const html = `<html><head>
<script src="https://cdn.example.com/lib.js"></script>
</head><body><div data-proto-id="x">Hi</div></body></html>`;

    const result = validateHtml(html);
    const warnings = result.issues.filter(
      (i) => i.type === "warning" && i.message.includes("Non-CDN"),
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("does not warn about allowed CDN dependencies", () => {
    const html = `<html><head>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet">
</head><body><div data-proto-id="x">Hi</div></body></html>`;

    const result = validateHtml(html);
    const cdnWarnings = result.issues.filter(
      (i) => i.type === "warning" && i.message.includes("Non-CDN"),
    );
    expect(cdnWarnings).toHaveLength(0);
  });

  it("warns when no data-proto-id attributes found", () => {
    const html = `<html><body><div>No ids here</div></body></html>`;
    const result = validateHtml(html);
    const warnings = result.issues.filter(
      (i) => i.message.includes("No data-proto-id"),
    );
    expect(warnings).toHaveLength(1);
  });

  it("detects duplicate proto-ids", () => {
    const html = `<div data-proto-id="dup">A</div>
<div data-proto-id="dup">B</div>
<div data-proto-id="unique">C</div>`;

    const result = validateHtml(html);
    expect(result.valid).toBe(false);
    const errors = result.issues.filter(
      (i) => i.type === "error" && i.message.includes("Duplicate"),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("dup");
  });

  it("returns invalid for empty content", () => {
    const result = validateHtml("");
    expect(result.valid).toBe(false);
  });

  it("passes when all previous IDs are present", () => {
    const html = `<div data-proto-id="a">A</div>
<div data-proto-id="b">B</div>`;

    const result = validateHtml(html, ["a", "b"]);
    expect(result.valid).toBe(true);
  });

  it("handles combined issues", () => {
    const html = `<!-- @TODO[data-proto-id="x"] Fix this -->
<div data-proto-id="x">Content</div>
<script src="https://cdn.example.com/lib.js"></script>`;

    const result = validateHtml(html, ["x", "missing-id"]);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });
});

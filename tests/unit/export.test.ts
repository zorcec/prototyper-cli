import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exportFile, getExportPreamble, exportTasks } from "../../src/commands/export.js";
import { createTask, ensureTaskDirs } from "../../src/core/tasks.js";

describe("exportFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-export-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates prompt with HTML content", () => {
    const html = `<!DOCTYPE html><html><body>
<div data-proto-id="hero">Hello World</div>
</body></html>`;

    const filePath = join(tempDir, "test.html");
    writeFileSync(filePath, html, "utf-8");

    const result = exportFile(filePath);
    expect(result.prompt).toContain("Hello World");
    expect(result.prompt).toContain("```html");
    expect(result.filePath).toBe(filePath);
  });

  it("includes annotation instructions in prompt", () => {
    const html = `<!-- @TODO[data-proto-id="btn"] Fix button -->
<button data-proto-id="btn">Click</button>`;

    const filePath = join(tempDir, "annotated.html");
    writeFileSync(filePath, html, "utf-8");

    const result = exportFile(filePath);
    expect(result.prompt).toContain("@TODO");
    expect(result.prompt).toContain("@KEEP");
    expect(result.prompt).toContain("Implement");
    expect(result.annotationCount).toBe(1);
  });

  it("counts annotations correctly", () => {
    const html = `<!-- @TODO[data-proto-id="a"] Fix -->
<!-- @FEATURE[data-proto-id="b"] Add -->
<!-- @KEEP[data-proto-id="c"] Keep -->
<div data-proto-id="a">A</div>
<div data-proto-id="b">B</div>
<div data-proto-id="c">C</div>`;

    const filePath = join(tempDir, "multi.html");
    writeFileSync(filePath, html, "utf-8");

    const result = exportFile(filePath);
    expect(result.annotationCount).toBe(3);
  });

  it("includes file name in prompt", () => {
    const filePath = join(tempDir, "my-prototype.html");
    writeFileSync(filePath, "<div>Test</div>", "utf-8");

    const result = exportFile(filePath);
    expect(result.prompt).toContain("my-prototype.html");
  });

  it("handles HTML without annotations", () => {
    const filePath = join(tempDir, "clean.html");
    writeFileSync(filePath, "<div>Clean file</div>", "utf-8");

    const result = exportFile(filePath);
    expect(result.annotationCount).toBe(0);
    expect(result.prompt).toContain("Clean file");
  });
});

describe("getExportPreamble", () => {
  it("contains processing instructions for all tags", () => {
    const preamble = getExportPreamble();
    expect(preamble).toContain("@TODO");
    expect(preamble).toContain("@FEATURE");
    expect(preamble).toContain("@VARIANT");
    expect(preamble).toContain("@KEEP");
    expect(preamble).toContain("@QUESTION");
    expect(preamble).toContain("@CONTEXT");
  });

  it("tells LLM to remove implemented annotations", () => {
    const preamble = getExportPreamble();
    expect(preamble).toContain("REMOVE");
  });

  it("tells LLM to preserve KEEP elements", () => {
    const preamble = getExportPreamble();
    expect(preamble).toContain("NEVER modify");
  });
});

describe("exportTasks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-export-tasks-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports tasks as an LLM prompt", () => {
    createTask(tempDir, {
      title: "Fix header",
      description: "Make it sticky",
      status: "todo",
      priority: "high",
      tag: "TODO",
      selector: '[data-proto-id="header"]',
    });

    const result = exportTasks(tempDir);
    expect(result.taskCount).toBe(1);
    expect(result.prompt).toContain("Fix header");
    expect(result.prompt).toContain("TODO");
    expect(result.prompt).toContain("Active Tasks");
  });

  it("excludes done tasks from active count", () => {
    createTask(tempDir, {
      title: "Done task",
      description: "",
      status: "done",
      priority: "low",
      tag: "TODO",
      selector: '[data-proto-id="done"]',
    });
    createTask(tempDir, {
      title: "Active task",
      description: "",
      status: "todo",
      priority: "medium",
      tag: "FEATURE",
      selector: '[data-proto-id="active"]',
    });

    const result = exportTasks(tempDir);
    expect(result.taskCount).toBe(1);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Active task");
  });

  it("returns empty prompt when no tasks exist", () => {
    ensureTaskDirs(tempDir);
    const result = exportTasks(tempDir);
    expect(result.taskCount).toBe(0);
    expect(result.prompt).toContain("No active tasks");
  });
});

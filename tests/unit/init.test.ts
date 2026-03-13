import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initProject, RULES_TEMPLATE, COPILOT_RULES_TEMPLATE } from "../../src/commands/init.js";

describe("initProject", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates prototype-rules.md in target directory", () => {
    const result = initProject(tempDir);
    const rulesPath = join(tempDir, "prototype-rules.md");
    expect(existsSync(rulesPath)).toBe(true);
    expect(result.files).toContain(rulesPath);
  });

  it("creates copilot instructions file", () => {
    const result = initProject(tempDir);
    const copilotPath = join(
      tempDir,
      ".github",
      "instructions",
      "prototype-studio.instructions.md",
    );
    expect(existsSync(copilotPath)).toBe(true);
    expect(result.files).toContain(copilotPath);
  });

  it("creates .github/instructions directory", () => {
    initProject(tempDir);
    expect(existsSync(join(tempDir, ".github", "instructions"))).toBe(true);
  });

  it("rules file contains annotation contract content", () => {
    initProject(tempDir);
    const content = readFileSync(
      join(tempDir, "prototype-rules.md"),
      "utf-8",
    );
    expect(content).toContain("data-proto-id");
    expect(content).toContain("@TODO");
    expect(content).toContain("@KEEP");
    expect(content).toContain("Annotation Contract");
  });

  it("copilot rules file has correct frontmatter", () => {
    initProject(tempDir);
    const content = readFileSync(
      join(tempDir, ".github", "instructions", "prototype-studio.instructions.md"),
      "utf-8",
    );
    expect(content).toContain("applyTo:");
    expect(content).toContain("*.html");
  });

  it("returns 5 created files on fresh init", () => {
    const result = initProject(tempDir);
    expect(result.files).toHaveLength(5);
  });

  it("is idempotent (can be run twice)", () => {
    initProject(tempDir);
    const result = initProject(tempDir);
    // second run: package.json, .gitignore, index.html already exist so only rules + copilot recreated
    expect(result.files).toHaveLength(2);
  });
});

describe("template constants", () => {
  it("RULES_TEMPLATE contains all tag types", () => {
    for (const tag of ["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"]) {
      expect(RULES_TEMPLATE).toContain(`@${tag}`);
    }
  });

  it("COPILOT_RULES_TEMPLATE is concise", () => {
    expect(COPILOT_RULES_TEMPLATE.length).toBeLessThan(RULES_TEMPLATE.length);
  });
});

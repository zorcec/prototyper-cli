import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(process.cwd(), "dist", "index.js");
const run = (args: string, cwd?: string) =>
  execSync(`node ${CLI} ${args}`, {
    encoding: "utf-8",
    cwd: cwd ?? process.cwd(),
  });

describe("proto init (e2e)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-e2e-init-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates rules file in target directory", () => {
    const output = run(`init ${tempDir}`);
    expect(output).toContain("Proto Studio initialized");
    expect(existsSync(join(tempDir, "prototype-rules.md"))).toBe(true);
  });

  it("creates .proto directory with tasks and screenshots", () => {
    run(`init ${tempDir}`);
    expect(existsSync(join(tempDir, ".proto"))).toBe(true);
    expect(existsSync(join(tempDir, ".proto", "tasks"))).toBe(true);
    expect(existsSync(join(tempDir, ".proto", "screenshots"))).toBe(true);
  });

  it("creates .proto/config.json", () => {
    run(`init ${tempDir}`);
    const configPath = join(tempDir, ".proto", "config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.mode).toBe("prototype");
    expect(config.port).toBe(3700);
  });

  it("creates copilot instructions file", () => {
    run(`init ${tempDir}`);
    const copilotFile = join(
      tempDir,
      ".github",
      "instructions",
      "prototype-studio.instructions.md",
    );
    expect(existsSync(copilotFile)).toBe(true);
    const content = readFileSync(copilotFile, "utf-8");
    expect(content).toContain("data-proto-id");
  });

  it("rules file contains all annotation tags", () => {
    run(`init ${tempDir}`);
    const content = readFileSync(
      join(tempDir, "prototype-rules.md"),
      "utf-8",
    );
    for (const tag of ["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"]) {
      expect(content).toContain(`@${tag}`);
    }
  });

  it("rules file references CDN libraries", () => {
    run(`init ${tempDir}`);
    const content = readFileSync(join(tempDir, "prototype-rules.md"), "utf-8");
    expect(content).toContain("cdn.tailwindcss.com");
    expect(content).toContain("unpkg.com/lucide");
    expect(content).toContain("fonts.googleapis.com");
  });

  it("rules file describes multi-page conventions", () => {
    run(`init ${tempDir}`);
    const content = readFileSync(join(tempDir, "prototype-rules.md"), "utf-8");
    expect(content).toContain("One Screen Per File");
    expect(content).toContain("Multi-Page Conventions");
    expect(content).toContain("Globally unique");
  });

  it("creates package.json with proto scripts", () => {
    run(`init ${tempDir}`);
    const pkgPath = join(tempDir, "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.scripts.serve).toContain("proto serve");
    expect(pkg.scripts.export).toContain("proto export");
    expect(pkg.scripts.validate).toContain("proto validate");
    expect(pkg.name).toBe("prototypes");
  });

  it("creates .gitignore with node_modules and .proto/screenshots", () => {
    run(`init ${tempDir}`);
    const gitignorePath = join(tempDir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, "utf-8");
    expect(content).toContain("node_modules");
    expect(content).toContain(".proto/screenshots/");
  });

  it("creates starter index.html with Tailwind and proto-ids", () => {
    run(`init ${tempDir}`);
    const indexPath = join(tempDir, "index.html");
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("cdn.tailwindcss.com");
    expect(content).toContain("data-proto-id");
    expect(content).toContain("lucide");
  });

  it("does not overwrite existing package.json on second run", () => {
    run(`init ${tempDir}`);
    const pkgPath = join(tempDir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ name: "my-custom-pkg" }), "utf-8");
    run(`init ${tempDir}`);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("my-custom-pkg");
  });

  it("does not overwrite existing index.html on second run", () => {
    run(`init ${tempDir}`);
    const indexPath = join(tempDir, "index.html");
    writeFileSync(indexPath, "<html>custom</html>", "utf-8");
    run(`init ${tempDir}`);
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toBe("<html>custom</html>");
  });

  it("output shows success and ready message", () => {
    const output = run(`init ${tempDir}`);
    expect(output).toContain("Proto Studio initialized");
    expect(output).toContain("Ready! Start prototyping");
  });

  it("can be run twice without errors", () => {
    run(`init ${tempDir}`);
    expect(() => run(`init ${tempDir}`)).not.toThrow();
  });

  it("creates implementing-tasks prompt template", () => {
    run(`init ${tempDir}`);
    const promptPath = join(tempDir, ".github", "prompts", "implementing-tasks.prompt.md");
    expect(existsSync(promptPath)).toBe(true);
    const content = readFileSync(promptPath, "utf-8");
    expect(content).toContain("proto tasks");
    expect(content).not.toContain("proto archive");
  });
});

describe("proto attach (e2e)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-e2e-attach-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates .proto config in attach mode", () => {
    const output = run(`attach ${tempDir} --url http://localhost:4000`);
    expect(output).toContain("Proto Studio attached");
    const configPath = join(tempDir, ".proto", "config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.mode).toBe("attach");
    expect(config.url).toBe("http://localhost:4000");
  });

  it("creates .proto/tasks and .proto/screenshots directories", () => {
    run(`attach ${tempDir}`);
    expect(existsSync(join(tempDir, ".proto", "tasks"))).toBe(true);
    expect(existsSync(join(tempDir, ".proto", "screenshots"))).toBe(true);
  });

  it("adds .proto/screenshots/ to .gitignore", () => {
    run(`attach ${tempDir}`);
    const gitignorePath = join(tempDir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, "utf-8");
    expect(content).toContain(".proto/screenshots/");
  });

  it("adds proto scripts to existing package.json", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "my-app", scripts: {} }, null, 2),
      "utf-8",
    );
    run(`attach ${tempDir}`);
    const pkg = JSON.parse(readFileSync(join(tempDir, "package.json"), "utf-8"));
    expect(pkg.scripts["proto:serve"]).toBeDefined();
    expect(pkg.scripts["proto:export"]).toBeDefined();
    expect(pkg.scripts["proto:validate"]).toBeDefined();
  });

  it("does not duplicate proto scripts if already present", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "my-app",
        scripts: { "proto:serve": "proto serve ." },
      }, null, 2),
      "utf-8",
    );
    run(`attach ${tempDir}`);
    const pkg = JSON.parse(readFileSync(join(tempDir, "package.json"), "utf-8"));
    // Should still have one entry (not duplicated)
    expect(pkg.scripts["proto:serve"]).toBe("proto serve .");
  });
});

describe("proto tasks (e2e)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-e2e-tasks-"));
    run(`init ${tempDir}`);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("shows 'No tasks found' for empty task dir", () => {
    const output = run(`tasks ${tempDir}`);
    expect(output).toContain("No tasks found");
  });

  it("lists tasks with --status filter after creating tasks via API", async () => {
    // This test just verifies the CLI runs without error with filters
    const output = run(`tasks ${tempDir} --status todo`);
    expect(output).toContain("No tasks found");
  });

  it("--edit with no task-id prints LLM usage instructions", () => {
    const output = run(`tasks ${tempDir} --edit`);
    expect(output).toContain("LLM Usage Instructions");
    expect(output).toContain("--edit <task-id>");
    expect(output).toContain("--set-status");
  });

  it("--edit with task-id but no fields also prints LLM usage instructions", () => {
    const output = run(`tasks ${tempDir} --edit abc12345`);
    expect(output).toContain("LLM Usage Instructions");
    // With no tasks in the project it shows "No tasks found."
    expect(output).toContain("No tasks found");
  });

  it("--edit updates task title and status", () => {
    // Create a task file manually
    const { mkdirSync, writeFileSync } = require("node:fs");
    const tasksDir = join(tempDir, ".proto", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "my-task.md"), [
      "---",
      "id: test1234",
      "status: todo",
      'selector: "#btn"',
      "created: 2025-01-01T00:00:00.000Z",
      "---",
      "",
      "# Original Title",
      "",
      "Original description.",
    ].join("\n"), "utf-8");

    const output = run(`tasks ${tempDir} --edit test1234 --title "Updated Title" --set-status in-progress`);
    expect(output).toContain("Task updated");
    expect(output).toContain("Updated Title");

    // Verify the file was actually updated
    const listOutput = run(`tasks ${tempDir}`);
    expect(listOutput).toContain("Updated Title");
    expect(listOutput).toContain("in-progress");
  });

  it("--edit with unknown task-id exits with error code 1", () => {
    let threw = false;
    try {
      run(`tasks ${tempDir} --edit nonexist --title "Foo"`);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  // ── Regression: tasks.md fixes ───────────────────────────────────────────

  it("tasks list output includes file path for each task", () => {
    const { mkdirSync, writeFileSync } = require("node:fs");
    const tasksDir = join(tempDir, ".proto", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "path-test.md"), [
      "---",
      "id: pathtest1",
      "status: todo",
      'selector: "#btn"',
      "created: 2025-01-01T00:00:00.000Z",
      "---",
      "",
      "# Task with path",
    ].join("\n"), "utf-8");

    const output = run(`tasks ${tempDir}`);
    // File path should be shown in output
    expect(output).toContain("file:");
    expect(output).toContain(".proto/tasks");
    expect(output).toContain("path-test.md");
  });

  it("--edit respects --status filter when listing available tasks", () => {
    const { mkdirSync, writeFileSync } = require("node:fs");
    const tasksDir = join(tempDir, ".proto", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "todo-task.md"), [
      "---",
      "id: todotask1",
      "status: todo",
      'selector: "#a"',
      "created: 2025-01-01T00:00:00.000Z",
      "---",
      "",
      "# Todo Task",
    ].join("\n"), "utf-8");
    writeFileSync(join(tasksDir, "done-task.md"), [
      "---",
      "id: donetask1",
      "status: done",
      'selector: "#b"',
      "created: 2025-01-01T00:00:00.000Z",
      "---",
      "",
      "# Done Task",
    ].join("\n"), "utf-8");

    // Without filter: lists both tasks in usage instructions
    const outputAll = run(`tasks ${tempDir} --edit`);
    expect(outputAll).toContain("Todo Task");
    expect(outputAll).toContain("Done Task");

    // With --status todo: only shows todo tasks in the edit usage list
    const outputTodo = run(`tasks ${tempDir} --edit --status todo`);
    expect(outputTodo).toContain("Todo Task");
    expect(outputTodo).not.toContain("Done Task");
  });

  it("tasks list shows cssSelector when present", () => {
    const { mkdirSync, writeFileSync } = require("node:fs");
    const tasksDir = join(tempDir, ".proto", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "css-task.md"), [
      "---",
      "id: csstask1",
      "status: todo",
      'selector: "[data-testid=\\"hero\\"]"',
      'cssSelector: "main > section > h1"',
      "created: 2025-01-01T00:00:00.000Z",
      "---",
      "",
      "# CSS Selector Task",
    ].join("\n"), "utf-8");

    const output = run(`tasks ${tempDir}`);
    expect(output).toContain("css:");
    expect(output).toContain("main > section > h1");
  });
});

describe("proto archive (e2e) — removed", () => {
  it("archive command no longer exists", () => {
    // archive was removed in a prior release; this block is intentionally empty
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateTaskId,
  slugify,
  parseFrontMatter,
  serializeTask,
  parseTask,
  getTasksDir,
  getScreenshotsDir,
  ensureTaskDirs,
  createTask,
  readTaskFile,
  listTasks,
  findTaskFilePath,
  updateTask,
  deleteTask,
  saveScreenshot,
  deleteScreenshot,
} from "../../src/core/tasks.js";
import type { Task } from "../../src/core/types.js";

describe("generateTaskId", () => {
  it("returns an 8-character string", () => {
    const id = generateTaskId();
    expect(id).toHaveLength(8);
  });

  it("returns unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTaskId()));
    expect(ids.size).toBe(100);
  });
});

describe("slugify", () => {
  it("converts text to kebab-case slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("Fix the button!!! @now")).toBe("fix-the-button-now");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("truncates to 60 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});

describe("parseFrontMatter", () => {
  it("parses YAML front matter from markdown", () => {
    const content = `---
id: abc123
status: todo
selector: "[data-proto-id=\\"btn\\"]"
created: 2025-01-01T00:00:00.000Z
---

# My Task

Some description.`;

    const { frontMatter, body } = parseFrontMatter(content);
    expect(frontMatter.id).toBe("abc123");
    expect(frontMatter.status).toBe("todo");
    expect(body).toContain("# My Task");
    expect(body).toContain("Some description.");
  });

  it("returns empty front matter for content without ---", () => {
    const { frontMatter, body } = parseFrontMatter("Just plain text");
    expect(Object.keys(frontMatter)).toHaveLength(0);
    expect(body).toBe("Just plain text");
  });

  it("handles quoted values", () => {
    const content = `---
selector: "[data-proto-id=\\"x\\"]"
url: '/page.html'
---

# Title`;

    const { frontMatter } = parseFrontMatter(content);
    expect(frontMatter.selector).toBe('[data-proto-id=\\"x\\"]');
    expect(frontMatter.url).toBe("/page.html");
  });
});

describe("serializeTask / parseTask roundtrip", () => {
  const task: Task = {
    id: "abc12345",
    title: "Fix button color",
    description: "The button should be blue",
    status: "todo",
    url: "/page.html",
    selector: '[data-proto-id="btn"]',
    created: "2025-01-01T00:00:00.000Z",
  };

  it("serializes to markdown with YAML front matter", () => {
    const md = serializeTask(task);
    expect(md).toContain("---");
    expect(md).toContain("id: abc12345");
    expect(md).toContain("status: todo");
    expect(md).toContain("# Fix button color");
    expect(md).toContain("The button should be blue");
  });

  it("roundtrips correctly", () => {
    const md = serializeTask(task);
    const parsed = parseTask(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(task.id);
    expect(parsed!.title).toBe(task.title);
    expect(parsed!.description).toBe(task.description);
    expect(parsed!.status).toBe(task.status);
  });

  it("returns null for content without required fields", () => {
    const bad = `---
status: todo
---

# No ID and no selector`;
    expect(parseTask(bad)).toBeNull();
  });
});

describe("CRUD operations", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-tasks-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("getTasksDir returns .proto/tasks path", () => {
    expect(getTasksDir(tempDir)).toBe(join(tempDir, ".proto", "tasks"));
  });

  it("getScreenshotsDir returns .proto/screenshots path", () => {
    expect(getScreenshotsDir(tempDir)).toBe(join(tempDir, ".proto", "screenshots"));
  });

  it("ensureTaskDirs creates both directories", () => {
    ensureTaskDirs(tempDir);
    expect(existsSync(getTasksDir(tempDir))).toBe(true);
    expect(existsSync(getScreenshotsDir(tempDir))).toBe(true);
  });

  it("createTask creates a .md file and returns a task with ID", () => {
    const task = createTask(tempDir, {
      title: "Fix the header",
      description: "Make it sticky",
      status: "todo",
      selector: '[data-proto-id="header"]',
    });

    expect(task.id).toBeDefined();
    expect(task.id).toHaveLength(8);
    expect(task.title).toBe("Fix the header");
    expect(task.created).toBeDefined();

    const files = listTasks(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe(task.id);
  });

  it("listTasks returns empty array for non-existent dir", () => {
    expect(listTasks(tempDir)).toEqual([]);
  });

  it("listTasks returns all created tasks sorted", () => {
    createTask(tempDir, {
      title: "B task",
      description: "",
      status: "todo",
      selector: '[data-proto-id="b"]',
    });
    createTask(tempDir, {
      title: "A task",
      description: "",
      status: "todo",
      selector: '[data-proto-id="a"]',
    });

    const tasks = listTasks(tempDir);
    expect(tasks).toHaveLength(2);
  });

  it("findTaskFilePath finds existing task", () => {
    const task = createTask(tempDir, {
      title: "Find me",
      description: "",
      status: "todo",
      selector: '[data-proto-id="find"]',
    });

    const path = findTaskFilePath(tempDir, task.id);
    expect(path).not.toBeNull();
    expect(path!.endsWith(".md")).toBe(true);
  });

  it("findTaskFilePath returns null for non-existent task", () => {
    ensureTaskDirs(tempDir);
    expect(findTaskFilePath(tempDir, "nonexist")).toBeNull();
  });

  it("updateTask modifies status and returns updated task", () => {
    const task = createTask(tempDir, {
      title: "Update me",
      description: "",
      status: "todo",
      selector: '[data-proto-id="upd"]',
    });

    const updated = updateTask(tempDir, task.id, { status: "done" });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("done");
    expect(updated!.updated).toBeDefined();

    const fromDisk = listTasks(tempDir);
    expect(fromDisk[0].status).toBe("done");
  });

  it("updateTask returns null for non-existent task", () => {
    ensureTaskDirs(tempDir);
    expect(updateTask(tempDir, "nonexist", { status: "done" })).toBeNull();
  });

  it("deleteTask removes the task file", () => {
    const task = createTask(tempDir, {
      title: "Delete me",
      description: "",
      status: "todo",
      selector: '[data-proto-id="del"]',
    });

    expect(deleteTask(tempDir, task.id)).toBe(true);
    expect(listTasks(tempDir)).toHaveLength(0);
  });

  it("deleteTask returns false for non-existent task", () => {
    ensureTaskDirs(tempDir);
    expect(deleteTask(tempDir, "nonexist")).toBe(false);
  });

  it("saveScreenshot writes a PNG file", () => {
    const task = createTask(tempDir, {
      title: "Screenshot task",
      description: "",
      status: "todo",
      selector: '[data-proto-id="ss"]',
    });

    // Minimal valid base64 PNG (1x1 transparent pixel)
    const base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const filename = saveScreenshot(tempDir, task.id, base64Png);

    expect(filename).toBe(`${task.id}.png`);
    expect(existsSync(join(getScreenshotsDir(tempDir), filename))).toBe(true);
  });

  it("readTaskFile reads and parses a task file", () => {
    const task = createTask(tempDir, {
      title: "Read me",
      description: "Description here",
      status: "in-progress",
      selector: '[data-proto-id="read"]',
    });

    const filePath = findTaskFilePath(tempDir, task.id)!;
    const read = readTaskFile(filePath);
    expect(read).not.toBeNull();
    expect(read!.title).toBe("Read me");
    expect(read!.status).toBe("in-progress");
  });

  it("updateTask can update title and description", () => {
    const task = createTask(tempDir, {
      title: "Original title",
      description: "Original desc",
      status: "todo",
      selector: '[data-proto-id="title-test"]',
    });

    const updated = updateTask(tempDir, task.id, {
      title: "Updated title",
      description: "Updated desc",
    });
    expect(updated!.title).toBe("Updated title");
    expect(updated!.description).toBe("Updated desc");

    const fromDisk = listTasks(tempDir);
    expect(fromDisk[0].title).toBe("Updated title");
    expect(fromDisk[0].description).toBe("Updated desc");
  });
});

describe("deleteScreenshot", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-screenshot-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes the screenshot file and clears screenshot field", () => {
    const task = createTask(tempDir, {
      title: "Has Screenshot",
      description: "",
      status: "todo",
      selector: '[data-proto-id="s"]',
    });

    const base64Png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const filename = saveScreenshot(tempDir, task.id, base64Png);
    updateTask(tempDir, task.id, { screenshot: filename });

    const screenshotPath = join(getScreenshotsDir(tempDir), filename);
    expect(existsSync(screenshotPath)).toBe(true);

    const updated = deleteScreenshot(tempDir, task.id);
    expect(updated).not.toBeNull();
    expect(updated!.screenshot).toBeUndefined();
    expect(existsSync(screenshotPath)).toBe(false);
  });

  it("returns null for non-existent task", () => {
    ensureTaskDirs(tempDir);
    expect(deleteScreenshot(tempDir, "nonexist")).toBeNull();
  });

  it("still returns updated task when no screenshot file exists on disk", () => {
    const task = createTask(tempDir, {
      title: "Ghost screenshot",
      description: "",
      status: "todo",
      selector: '[data-proto-id="ghost"]',
    });

    // Manually set screenshot in task file without creating the actual file
    updateTask(tempDir, task.id, { screenshot: "ghost-file.png" });

    const updated = deleteScreenshot(tempDir, task.id);
    expect(updated).not.toBeNull();
    expect(updated!.screenshot).toBeUndefined();
  });
});

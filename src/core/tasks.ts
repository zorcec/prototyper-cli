import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Task, TaskStatus, AnnotationTag } from "./types.js";
import {
  ANNOTATION_TAGS,
  PROTO_DIR,
  TASKS_DIR,
  SCREENSHOTS_DIR,
} from "./types.js";

const VALID_STATUSES: TaskStatus[] = ["todo", "in-progress", "done"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

export function generateTaskId(): string {
  return randomUUID().slice(0, 8);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function uniqueFilename(dir: string, slug: string): string {
  let name = `${slug}.md`;
  let counter = 2;
  while (existsSync(join(dir, name))) {
    name = `${slug}-${counter}.md`;
    counter++;
  }
  return name;
}

// ── YAML front matter parser (simple key-value, no dependency) ─────────────
export function parseFrontMatter(content: string): {
  frontMatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontMatter: {}, body: content.trim() };

  const yaml = match[1];
  const body = match[2].trim();
  const frontMatter: Record<string, string> = {};

  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    frontMatter[key] = value;
  }

  return { frontMatter, body };
}

// ── Serialize task to .md content ──────────────────────────────────────────
export function serializeTask(task: Task): string {
  const lines = [
    "---",
    `id: ${task.id}`,
    `status: ${task.status}`,
    `priority: ${task.priority}`,
    `tag: ${task.tag}`,
  ];

  if (task.url) lines.push(`url: "${task.url}"`);
  lines.push(`selector: "${task.selector}"`);
  if (task.screenshot) lines.push(`screenshot: ${task.screenshot}`);
  lines.push(`created: ${task.created}`);
  if (task.updated) lines.push(`updated: ${task.updated}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${task.title}`);
  lines.push("");
  if (task.description) {
    lines.push(task.description);
    lines.push("");
  }

  return lines.join("\n");
}

// ── Parse task from .md content ────────────────────────────────────────────
export function parseTask(content: string): Task | null {
  const { frontMatter, body } = parseFrontMatter(content);

  if (!frontMatter.id || !frontMatter.tag || !frontMatter.selector) {
    return null;
  }

  const titleMatch = body.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled";
  const description = body.replace(/^#\s+.+\n*/m, "").trim();

  return {
    id: frontMatter.id,
    title,
    description,
    status: (VALID_STATUSES.includes(frontMatter.status as TaskStatus)
      ? frontMatter.status
      : "todo") as TaskStatus,
    priority: VALID_PRIORITIES.includes(frontMatter.priority)
      ? (frontMatter.priority as Task["priority"])
      : "medium",
    tag: (ANNOTATION_TAGS as readonly string[]).includes(frontMatter.tag)
      ? (frontMatter.tag as AnnotationTag)
      : "TODO",
    url: frontMatter.url || undefined,
    selector: frontMatter.selector,
    screenshot: frontMatter.screenshot || undefined,
    created: frontMatter.created || new Date().toISOString(),
    updated: frontMatter.updated || undefined,
  };
}

// ── Directory helpers ──────────────────────────────────────────────────────
export function getTasksDir(projectDir: string): string {
  return join(projectDir, PROTO_DIR, TASKS_DIR);
}

export function getScreenshotsDir(projectDir: string): string {
  return join(projectDir, PROTO_DIR, SCREENSHOTS_DIR);
}

export function ensureTaskDirs(projectDir: string): void {
  mkdirSync(getTasksDir(projectDir), { recursive: true });
  mkdirSync(getScreenshotsDir(projectDir), { recursive: true });
}

// ── CRUD operations ────────────────────────────────────────────────────────
export function createTask(
  projectDir: string,
  input: Omit<Task, "id" | "created">,
): Task {
  ensureTaskDirs(projectDir);

  const task: Task = {
    ...input,
    id: generateTaskId(),
    created: new Date().toISOString(),
  };

  const tasksDir = getTasksDir(projectDir);
  const slug = slugify(task.title);
  const filename = uniqueFilename(tasksDir, slug || task.id);
  writeFileSync(join(tasksDir, filename), serializeTask(task), "utf-8");

  return task;
}

export function readTaskFile(filePath: string): Task | null {
  const content = readFileSync(filePath, "utf-8");
  return parseTask(content);
}

export function listTasks(projectDir: string): Task[] {
  const tasksDir = getTasksDir(projectDir);
  if (!existsSync(tasksDir)) return [];

  return readdirSync(tasksDir)
    .filter((f) => extname(f) === ".md")
    .sort()
    .map((f) => readTaskFile(join(tasksDir, f)))
    .filter((t): t is Task => t !== null);
}

export function findTaskFilePath(
  projectDir: string,
  taskId: string,
): string | null {
  const tasksDir = getTasksDir(projectDir);
  if (!existsSync(tasksDir)) return null;

  for (const filename of readdirSync(tasksDir)) {
    if (extname(filename) !== ".md") continue;
    const filePath = join(tasksDir, filename);
    const content = readFileSync(filePath, "utf-8");
    const { frontMatter } = parseFrontMatter(content);
    if (frontMatter.id === taskId) return filePath;
  }
  return null;
}

export function updateTask(
  projectDir: string,
  taskId: string,
  updates: Partial<Pick<Task, "status" | "priority" | "title" | "description" | "screenshot" | "tag">>,
): Task | null {
  const filePath = findTaskFilePath(projectDir, taskId);
  if (!filePath) return null;

  const task = readTaskFile(filePath);
  if (!task) return null;

  const updated: Task = {
    ...task,
    ...updates,
    updated: new Date().toISOString(),
  };

  writeFileSync(filePath, serializeTask(updated), "utf-8");
  return updated;
}

export function deleteTask(projectDir: string, taskId: string): boolean {
  const filePath = findTaskFilePath(projectDir, taskId);
  if (!filePath) return false;
  unlinkSync(filePath);
  return true;
}

export function saveScreenshot(
  projectDir: string,
  taskId: string,
  imageData: string,
): string {
  ensureTaskDirs(projectDir);
  const screenshotsDir = getScreenshotsDir(projectDir);
  const filename = `${taskId}.png`;

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  writeFileSync(join(screenshotsDir, filename), buffer);

  return filename;
}

export function deleteScreenshot(
  projectDir: string,
  taskId: string,
): Task | null {
  const filePath = findTaskFilePath(projectDir, taskId);
  if (!filePath) return null;

  const task = readTaskFile(filePath);
  if (!task) return null;

  if (task.screenshot) {
    const screenshotPath = join(getScreenshotsDir(projectDir), task.screenshot);
    if (existsSync(screenshotPath)) unlinkSync(screenshotPath);
  }

  const updated: Task = { ...task, screenshot: undefined, updated: new Date().toISOString() };
  writeFileSync(filePath, serializeTask(updated), "utf-8");
  return updated;
}

export function archiveTasks(
  projectDir: string,
  filter: "done" | "all",
  reason: string,
): { archived: number; archiveFile: string } {
  const allTasks = listTasks(projectDir);
  const toArchive = filter === "done"
    ? allTasks.filter((t) => t.status === "done")
    : allTasks;

  if (toArchive.length === 0) return { archived: 0, archiveFile: "" };

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const archiveFilename = `archive-${timestamp}.md`;
  const archivePath = join(projectDir, PROTO_DIR, archiveFilename);

  const lines: string[] = [
    "# Archived Tasks",
    "",
    `**Archived:** ${new Date().toISOString()}`,
    `**Reason:** ${reason}`,
    `**Total:** ${toArchive.length} tasks`,
    "",
  ];

  for (const task of toArchive) {
    lines.push("---", "", serializeTask(task), "");
  }

  writeFileSync(archivePath, lines.join("\n"), "utf-8");

  for (const task of toArchive) {
    const fp = findTaskFilePath(projectDir, task.id);
    if (fp) unlinkSync(fp);
  }

  return { archived: toArchive.length, archiveFile: archivePath };
}

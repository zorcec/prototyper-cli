import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, basename, extname, dirname } from "node:path";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import chalk from "chalk";
import { injectScript } from "../core/html-parser.js";
import { createFileWatcher } from "./watcher.js";
import { getOverlayScript } from "../client/overlay.js";
import {
  createTask,
  listTasks,
  updateTask,
  deleteTask,
  saveScreenshot,
  deleteScreenshot,
  ensureTaskDirs,
  getScreenshotsDir,
} from "../core/tasks.js";
import { ANNOTATION_TAGS } from "../core/types.js";
import type { AnnotationTag, ServeOptions, Task } from "../core/types.js";
import type { FSWatcher } from "chokidar";

export interface ServeInstance {
  url: string;
  close: () => Promise<void>;
}

type BroadcastFn = (data: object) => void;

/** Registers all /api/tasks routes on the given Express app. */
function registerTaskApi(
  app: express.Application,
  projectDir: string,
  broadcast: BroadcastFn,
): void {
  app.get("/api/tasks", (_req, res) => {
    const tasks = listTasks(projectDir);
    res.json({ tasks });
  });

  app.post("/api/tasks", (req, res) => {
    const { title, description, tag, selector, url, priority, screenshot } =
      req.body as {
        title?: string;
        description?: string;
        tag?: string;
        selector?: string;
        url?: string;
        priority?: string;
        screenshot?: string;
      };

    if (!title || !selector || !tag) {
      res.status(400).json({ error: "Missing required fields: title, selector, tag" });
      return;
    }

    if (!(ANNOTATION_TAGS as readonly string[]).includes(tag)) {
      res.status(400).json({ error: `Invalid tag: ${tag}` });
      return;
    }

    const task = createTask(projectDir, {
      title,
      description: description || "",
      tag: tag as AnnotationTag,
      selector,
      url: url || undefined,
      priority: (priority as Task["priority"]) || "medium",
      status: "todo",
      screenshot: undefined,
    });

    if (screenshot) {
      const filename = saveScreenshot(projectDir, task.id, screenshot);
      updateTask(projectDir, task.id, { screenshot: filename });
      task.screenshot = filename;
    }

    broadcast({ type: "tasks-updated" });
    res.json({ success: true, task });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body as Partial<
      Pick<Task, "status" | "priority" | "title" | "description" | "tag">
    >;

    const updated = updateTask(projectDir, id, updates);
    if (!updated) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    broadcast({ type: "tasks-updated" });
    res.json({ success: true, task: updated });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const deleted = deleteTask(projectDir, id);
    if (!deleted) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    broadcast({ type: "tasks-updated" });
    res.json({ success: true });
  });

  app.post("/api/tasks/:id/screenshot", (req, res) => {
    const { id } = req.params;
    const { screenshot } = req.body as { screenshot?: string };
    if (!screenshot) {
      res.status(400).json({ error: "Missing screenshot data" });
      return;
    }

    const filename = saveScreenshot(projectDir, id, screenshot);
    const updated = updateTask(projectDir, id, { screenshot: filename });
    if (!updated) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json({ success: true, screenshot: filename });
  });

  app.delete("/api/tasks/:id/screenshot", (req, res) => {
    const { id } = req.params;
    const updated = deleteScreenshot(projectDir, id);
    if (!updated) {
      res.status(404).json({ error: "Task not found or no screenshot" });
      return;
    }
    broadcast({ type: "tasks-updated" });
    res.json({ success: true });
  });
}

/**
 * API-only mode: starts the task API server without serving any HTML files.
 * Intended for use with existing hosted/served projects — the Chrome extension
 * connects to this server to read and write tasks while you browse your app.
 */
async function serveApiOnly(
  projectDir: string,
  options: ServeOptions,
): Promise<ServeInstance> {
  ensureTaskDirs(projectDir);

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  const broadcast = (data: object) => {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  };

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch { /* ignore non-JSON */ }
    });
  });

  const screenshotsDir = getScreenshotsDir(projectDir);
  app.use("/screenshots", express.static(screenshotsDir, { maxAge: "1h" }));

  registerTaskApi(app, projectDir, broadcast);

  return new Promise<ServeInstance>((resolvePromise, reject) => {
    httpServer.listen(options.port, () => {
      const url = `http://localhost:${options.port}`;
      console.log(chalk.green(`✓ Prototype Studio API running at ${url}`));
      console.log(chalk.cyan("  Mode: API-only (connect Chrome extension to annotate your existing app)"));
      console.log(chalk.dim("  Task API: " + url + "/api/tasks"));
      console.log(chalk.dim("  Press Ctrl+C to stop\n"));

      resolvePromise({
        url,
        close: async () => {
          wss.close();
          await new Promise<void>((r) => httpServer.close(() => r()));
        },
      });
    });

    httpServer.on("error", reject);
  });
}

export async function serve(
  target: string | undefined,
  options: ServeOptions,
): Promise<ServeInstance> {
  // API-only mode: no target provided — just serve the task API for use with
  // an existing hosted project (the Chrome extension connects to this server).
  if (!target) {
    return serveApiOnly(process.cwd(), options);
  }

  const absTarget = resolve(target);
  const stat = statSync(absTarget);
  const isDir = stat.isDirectory();
  const htmlFiles = isDir
    ? readdirSync(absTarget)
        .filter((f) => extname(f) === ".html")
        .map((f) => join(absTarget, f))
    : [absTarget];

  if (htmlFiles.length === 0) {
    throw new Error("No HTML files found at " + target);
  }

  // Project root is where .proto/ lives (directory itself, or parent of file)
  const projectDir = isDir ? absTarget : dirname(absTarget);
  ensureTaskDirs(projectDir);

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  const broadcast = (data: object) => {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  };

  // Respond to ping from overlay/extension to keep connection alive
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch { /* ignore non-JSON */ }
    });
  });

  const overlayScript = options.noOverlay ? null : getOverlayScript(options.port);

  // ── Serve screenshots ────────────────────────────────────────────────────
  const screenshotsDir = getScreenshotsDir(projectDir);
  app.use(
    "/screenshots",
    express.static(screenshotsDir, { maxAge: "1h" }),
  );

  // ── Serve HTML files ─────────────────────────────────────────────────────
  if (isDir) {
    app.get("/", (_req, res) => {
      const links = htmlFiles
        .map((f) => {
          const name = basename(f);
          return `<li><a href="/${name}">${name}</a></li>`;
        })
        .join("\n");
      res.send(`<!DOCTYPE html><html><head><title>Prototype Studio</title>
<style>body{font-family:system-ui;max-width:600px;margin:40px auto;padding:0 20px}
a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
li{margin:8px 0}</style></head>
<body><h1>Prototype Studio</h1>
<p>Select a prototype to review:</p>
<ul>${links}</ul></body></html>`);
    });
  }

  for (const file of htmlFiles) {
    const route = isDir ? `/${basename(file)}` : "/";
    app.get(route, (_req, res) => {
      const html = readFileSync(file, "utf-8");
      const content = overlayScript ? injectScript(html, overlayScript) : html;
      res.type("html").send(content);
    });
  }

  // ── Task API ─────────────────────────────────────────────────────────────
  registerTaskApi(app, projectDir, broadcast);

  // Legacy annotation API (backward compat with old overlay/tests)
  app.post("/api/annotate", (req, res) => {
    const { file, targetSelector, tag, text } = req.body as {
      file?: string;
      targetSelector?: string;
      tag?: string;
      text?: string;
    };

    if (!file || !targetSelector || !tag || !text) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Resolve the target file
    const filePath = isDir ? join(absTarget, file) : absTarget;
    const fileExists = isDir
      ? htmlFiles.some((f) => basename(f) === file)
      : basename(absTarget) === file;

    if (!fileExists) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Create as a task instead of HTML comment
    const task = createTask(projectDir, {
      title: text.slice(0, 80),
      description: text,
      tag: (ANNOTATION_TAGS as readonly string[]).includes(tag)
        ? (tag as AnnotationTag)
        : "TODO",
      selector: targetSelector,
      url: `/${file}`,
      priority: "medium",
      status: "todo",
    });

    broadcast({ type: "tasks-updated" });
    res.json({ success: true, task });
  });

  // ── File watcher ─────────────────────────────────────────────────────────
  let watcher: FSWatcher | null = null;
  watcher = createFileWatcher(absTarget, {
    onChange: (changedPath) => {
      const name = basename(changedPath);
      console.log(chalk.dim(`  File changed: ${name}`));
      broadcast({ type: "reload", file: name });
    },
  });

  return new Promise<ServeInstance>((resolvePromise, reject) => {
    httpServer.listen(options.port, () => {
      const url = `http://localhost:${options.port}`;
      console.log(chalk.green(`✓ Prototype Studio running at ${url}`));
      for (const f of htmlFiles) {
        const route = isDir ? `/${basename(f)}` : "/";
        console.log(chalk.dim(`  ${basename(f)} → ${url}${route}`));
      }
      console.log(chalk.dim("  Task API: " + url + "/api/tasks"));
      console.log(chalk.dim("  Press Ctrl+C to stop\n"));

      if (options.open) {
        import("open").then((mod) => mod.default(url)).catch(() => {});
      }

      resolvePromise({
        url,
        close: async () => {
          if (watcher) await watcher.close();
          wss.close();
          await new Promise<void>((r) => httpServer.close(() => r()));
        },
      });
    });

    httpServer.on("error", reject);
  });
}

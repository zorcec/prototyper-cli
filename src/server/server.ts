import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, basename, extname, dirname } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
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
import type { ServeOptions, Task } from "../core/types.js";
import type { FSWatcher } from "chokidar";

export interface ServeInstance {
  url: string;
  close: () => Promise<void>;
}

type BroadcastFn = (data: object) => void;

/** Registers /api/pages — returns the list of HTML pages being served. */
function registerPagesApi(
  app: express.Application,
  pages: string[],
): void {
  app.get("/api/pages", (_req, res) => {
    res.json({ pages });
  });
}

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
    const { title, description, selector, cssSelector, url, screenshot } =
      req.body as {
        title?: string;
        description?: string;
        selector?: string;
        cssSelector?: string;
        url?: string;
        screenshot?: string;
      };

    if (!title || !selector) {
      res.status(400).json({ error: "Missing required fields: title, selector" });
      return;
    }

    const task = createTask(projectDir, {
      title,
      description: description || "",
      selector,
      cssSelector: cssSelector || undefined,
      url: url || undefined,
      status: "todo",
      screenshot: undefined,
    });

    if (screenshot) {
      const filename = saveScreenshot(projectDir, task.id, screenshot);
      updateTask(projectDir, task.id, { screenshot: filename });
      task.screenshot = filename;
    }

    console.log(`[Proto] Task created: "${task.title}" (${task.id})`);
    broadcast({ type: "tasks-updated" });
    res.json({ success: true, task });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body as Partial<
      Pick<Task, "status" | "title" | "description">
    >;

    const updated = updateTask(projectDir, id, updates);
    if (!updated) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    console.log(`[Proto] Task updated: "${updated.title}" (${updated.id}) → status:${updated.status}`);
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

    console.log(`[Proto] Task deleted: ${id}`);
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
 * CORS middleware: allow cross-origin requests so the overlay running inside an
 * existing app (different port/origin) can call the Proto Studio task API.
 * Safe for a localhost development tool.
 */
function useCors(app: express.Application): void {
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") { res.status(204).end(); return; }
    next();
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
  useCors(app);
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

  const overlayScript = getOverlayScript(options.port);
  app.get("/proto-overlay.js", (_req, res) => {
    res.type("application/javascript").send(overlayScript);
  });

  registerPagesApi(app, []);
  registerTaskApi(app, projectDir, broadcast);

  return new Promise<ServeInstance>((resolvePromise, reject) => {
    httpServer.listen(options.port, () => {
      const url = `http://localhost:${options.port}`;
      console.log(chalk.green(`✓ Proto Studio API running at ${url}`));
      console.log(chalk.cyan("  Mode: API-only (use Chrome extension or add the overlay script manually)"));
      console.log(chalk.dim("  Task API:      " + url + "/api/tasks"));
      console.log(chalk.dim("  Overlay script: " + url + "/proto-overlay.js"));
      console.log(chalk.dim("  Or run: proto serve <your-app-url>  to auto-proxy\n"));
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

/**
 * Proxy mode: transparently reverse-proxies an existing hosted app, injecting
 * the Proto Studio overlay into every HTML response.
 *
 * Usage: proto serve http://localhost:3000
 *
 * Benefits over API-only mode:
 *  - No Chrome extension needed
 *  - Next.js / Vite HMR WebSocket connections are forwarded to the upstream
 *  - CSP headers that would block the overlay are stripped automatically
 */
async function serveProxy(
  upstreamUrl: string,
  options: ServeOptions,
): Promise<ServeInstance> {
  const projectDir = process.cwd();
  ensureTaskDirs(projectDir);

  const upstream = new URL(upstreamUrl);
  const isHttps = upstream.protocol === "https:";
  const upstreamPort = upstream.port
    ? parseInt(upstream.port, 10)
    : isHttps ? 443 : 80;
  const requester = isHttps ? httpsRequest : httpRequest;

  const app = express();
  useCors(app);
  app.use(express.json({ limit: "10mb" }));

  const httpServer = createServer(app);
  // noServer: we handle upgrades manually to route Proto Studio WS vs. upstream WS
  const wss = new WebSocketServer({ noServer: true });

  const broadcast = (data: object) => {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  };

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch { /* ignore */ }
    });
  });

  // Route WebSocket upgrades: Proto Studio WS at "/" vs. upstream HMR at any other path
  httpServer.on("upgrade", (req, socket, head) => {
    const reqPath = req.url ?? "/";
    if (reqPath === "/" || reqPath === "") {
      // Proto Studio overlay WS
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
      return;
    }
    // Forward all other WS upgrades (Next.js HMR, Vite, webpack-dev-server, etc.)
    const wsScheme = isHttps ? "wss:" : "ws:";
    const upstreamWsUrl = `${wsScheme}//${upstream.host}${reqPath}`;
    const proxyWs = new WebSocket(upstreamWsUrl, {
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter(([k]) => !["host", "upgrade", "connection"].includes(k.toLowerCase()))
          .map(([k, v]) => [k, String(v)]),
      ),
    });
    proxyWs.on("open", () => {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        clientWs.on("message", (data, isBinary) => {
          if (proxyWs.readyState === WebSocket.OPEN) proxyWs.send(data, { binary: isBinary });
        });
        proxyWs.on("message", (data, isBinary) => {
          if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary });
        });
        clientWs.on("close", () => proxyWs.close());
        proxyWs.on("close", () => clientWs.close());
        clientWs.on("error", () => proxyWs.close());
        proxyWs.on("error", () => clientWs.close());
      });
    });
    proxyWs.on("error", () => socket.destroy());
  });

  const overlayScript = getOverlayScript(options.port);
  const screenshotsDir = getScreenshotsDir(projectDir);
  app.use("/screenshots", express.static(screenshotsDir, { maxAge: "1h" }));

  app.get("/proto-overlay.js", (_req, res) => {
    res.type("application/javascript").send(overlayScript);
  });

  registerPagesApi(app, []);
  registerTaskApi(app, projectDir, broadcast);

  // Proxy everything else to the upstream app
  app.use((req, res) => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers[k] = v;
    }
    headers["host"] = upstream.host;

    const proxyReq = requester(
      { hostname: upstream.hostname, port: upstreamPort, path: req.url, method: req.method, headers },
      (proxyRes) => {
        const contentType = proxyRes.headers["content-type"] ?? "";
        const isHtml = contentType.includes("text/html");

        // Build the response headers, stripping headers that would break the overlay
        const outHeaders: Record<string, string | string[] | undefined> = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          const key = k.toLowerCase();
          if (key === "content-security-policy" ||
              key === "content-security-policy-report-only" ||
              key === "x-frame-options") continue;
          if (isHtml && (key === "content-length" || key === "transfer-encoding")) continue;
          outHeaders[k] = v;
        }

        if (isHtml) {
          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            const injected = injectScript(body, overlayScript);
            outHeaders["content-type"] = "text/html; charset=utf-8";
            outHeaders["content-length"] = String(Buffer.byteLength(injected, "utf8"));
            res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
            res.end(injected);
          });
          proxyRes.on("error", (err) => {
            if (!res.headersSent) res.status(502).send(`[Proto Studio] Upstream error: ${err.message}`);
          });
        } else {
          res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
          proxyRes.pipe(res, { end: true });
        }
      },
    );

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.status(502).send(
          `[Proto Studio] Cannot reach ${upstreamUrl}: ${err.message}\nMake sure your app is running.`,
        );
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  return new Promise<ServeInstance>((resolvePromise, reject) => {
    httpServer.listen(options.port, () => {
      const url = `http://localhost:${options.port}`;
      console.log(chalk.green(`✓ Proto Studio proxy running at ${url}`));
      console.log(chalk.cyan(`  Proxying: ${upstreamUrl}  (overlay injected into all HTML pages)`));
      console.log(chalk.dim("  Task API:       " + url + "/api/tasks"));
      console.log(chalk.dim("  Overlay script: " + url + "/proto-overlay.js"));
      console.log(chalk.dim("  Press Ctrl+C to stop\n"));

      if (options.open) {
        import("open").then((mod) => mod.default(url)).catch(() => {});
      }

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
  // API-only mode: no target provided
  if (!target) {
    return serveApiOnly(process.cwd(), options);
  }

  // Proxy mode: target is a URL of an existing hosted app
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return serveProxy(target, options);
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
  useCors(app);
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

  // ── Serve overlay as a standalone JS file ────────────────────────────────
  if (overlayScript) {
    app.get("/proto-overlay.js", (_req, res) => {
      res.type("application/javascript").send(overlayScript);
    });
  }

  // ── Serve HTML files ─────────────────────────────────────────────────────
  if (isDir) {
    app.get("/", (_req, res) => {
      const links = htmlFiles
        .map((f) => {
          const name = basename(f);
          return `<li><a href="/${name}">${name}</a></li>`;
        })
        .join("\n");
      res.send(`<!DOCTYPE html><html><head><title>Proto Studio</title>
<style>body{font-family:system-ui;max-width:600px;margin:40px auto;padding:0 20px}
a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
li{margin:8px 0}</style></head>
<body><h1>Proto Studio</h1>
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
  const pageRoutes = htmlFiles.map((f) => `/${basename(f)}`);
  registerPagesApi(app, isDir ? pageRoutes : []);
  registerTaskApi(app, projectDir, broadcast);

  // Legacy annotation API (backward compat with old overlay/tests)
  app.post("/api/annotate", (req, res) => {
    const { file, targetSelector, tag, text } = req.body as {
      file?: string;
      targetSelector?: string;
      tag?: string;
      text?: string;
    };

    if (!file || !targetSelector || !text) {
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
      selector: targetSelector,
      url: `/${file}`,
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
      console.log(chalk.green(`✓ Proto Studio running at ${url}`));
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

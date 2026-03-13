import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename, extname } from "node:path";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, type Server as HttpServer } from "node:http";
import chalk from "chalk";
import { injectScript } from "../core/html-parser.js";
import { insertAnnotation, formatAnnotationComment } from "../core/annotations.js";
import { createFileWatcher } from "./watcher.js";
import { getOverlayScript } from "../client/overlay.js";
import type { AnnotationComment } from "../core/types.js";
import type { ServeOptions } from "../core/types.js";
import type { FSWatcher } from "chokidar";

export interface ServeInstance {
  url: string;
  close: () => Promise<void>;
}

export async function serve(
  target: string,
  options: ServeOptions,
): Promise<ServeInstance> {
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

  const app = express();
  app.use(express.json());
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

  const overlayScript = getOverlayScript(options.port);

  // Serve HTML files
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
      const injected = injectScript(html, overlayScript);
      res.type("html").send(injected);
    });
  }

  // Annotation API
  app.post("/api/annotate", (req, res) => {
    const { file, targetSelector, tag, text } = req.body as {
      file: string;
      targetSelector: string;
      tag: string;
      text: string;
    };

    if (!file || !targetSelector || !tag || !text) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const filePath = isDir ? join(absTarget, file) : absTarget;
    if (!htmlFiles.includes(filePath) || (isDir && !htmlFiles.some((f) => basename(f) === file))) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    if (!isDir && basename(absTarget) !== file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const annotation: AnnotationComment = {
      tag: tag as AnnotationComment["tag"],
      targetSelector,
      text,
    };

    const html = readFileSync(filePath, "utf-8");
    const updated = insertAnnotation(html, targetSelector, annotation);
    writeFileSync(filePath, updated, "utf-8");

    res.json({
      success: true,
      comment: formatAnnotationComment(annotation),
    });
  });

  // File watcher
  let watcher: FSWatcher | null = null;
  const watchTarget = isDir ? absTarget : absTarget;
  watcher = createFileWatcher(watchTarget, {
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

import { Command } from "commander";
import { initProject } from "./commands/init.js";
import { attachProject } from "./commands/attach.js";
import { serve } from "./server/server.js";
import { exportFile, exportDirectory, exportTasks, isDirectory as isDir } from "./commands/export.js";
import { validateFile, validateDirectory, isDirectory as isDir2 } from "./commands/validate.js";
import { listTasks, listTasksWithPaths, updateTask } from "./core/tasks.js";
import type { Task, TaskStatus } from "./core/types.js";
import { writeFileSync } from "node:fs";
import chalk from "chalk";

const program = new Command();

program
  .name("proto")
  .description(
    "Proto Studio — CLI tool for frontend prototyping with LLM assistance",
  )
  .version("1.0.0");

program
  .command("init")
  .description(
    "Initialize a new prototype project with rules, instructions, and .proto/ task directory",
  )
  .argument("[dir]", "Target directory", ".")
  .action((dir: string) => {
    initProject(dir);
  });

program
  .command("attach")
  .description(
    "Attach Proto Studio to an existing project for annotating a live webapp",
  )
  .argument("[dir]", "Project root directory", ".")
  .option("-u, --url <url>", "Webapp URL to annotate", "http://localhost:3000")
  .action((dir: string, opts: { url: string }) => {
    attachProject(dir, opts.url);
  });

program
  .command("serve")
  .description("Serve HTML prototype(s), proxy an existing app with overlay, or start API-only task server")
  .argument("[target]", "HTML file, directory of HTML files, or URL of an existing app (e.g. http://localhost:3000)")
  .option("-p, --port <port>", "Port number", "3700")
  .option("--no-open", "Do not open browser automatically")
  .action(async (target: string | undefined, opts: { port: string; open: boolean }) => {
    await serve(target, {
      port: parseInt(opts.port, 10),
      open: opts.open,
    });
  });

program
  .command("export")
  .description(
    "Export annotated HTML file(s) or tasks as a ready-to-paste LLM prompt",
  )
  .argument("<target>", "HTML file, directory, or project root with .proto/ tasks")
  .option("-c, --clipboard", "Copy to clipboard", false)
  .option("-o, --output <file>", "Write prompt to file")
  .option("--tasks", "Export tasks instead of HTML annotations", false)
  .action(
    async (
      target: string,
      opts: { clipboard: boolean; output?: string; tasks: boolean },
    ) => {
      let prompt: string;

      if (opts.tasks) {
        const result = exportTasks(target);
        prompt = result.prompt;
      } else if (isDir(target)) {
        const result = exportDirectory(target);
        prompt = result.prompt;
      } else {
        const result = exportFile(target);
        prompt = result.prompt;
      }

      if (opts.clipboard) {
        const { default: clipboardy } = await import("clipboardy");
        await clipboardy.write(prompt);
        console.log("  Copied to clipboard!");
      }

      if (opts.output) {
        writeFileSync(opts.output, prompt, "utf-8");
        console.log(`  Written to ${opts.output}`);
      }

      if (!opts.clipboard && !opts.output) {
        console.log("\n" + prompt);
      }
    },
  );

program
  .command("validate")
  .description(
    "Validate HTML prototype(s) against the annotation contract",
  )
  .argument("<target>", "HTML file or directory of HTML files")
  .option(
    "--previous <file>",
    "Previous version to compare element IDs against (single-file only)",
  )
  .action((target: string, opts: { previous?: string }) => {
    if (isDir2(target)) {
      const result = validateDirectory(target);
      process.exitCode = result.valid ? 0 : 1;
    } else {
      const result = validateFile(target, opts.previous);
      process.exitCode = result.valid ? 0 : 1;
    }
  });

program
  .command("tasks")
  .description("List or edit tasks in the project")
  .argument("[dir]", "Project root directory", ".")
  .option("--status <status>", "Filter by status (todo, in-progress, done)")
  .option("--edit [task-id]", "Edit a task by ID (LLM-friendly). Omit task-id to see usage instructions.")
  .option("--title <title>", "New title for the task (use with --edit)")
  .option("--set-status <status>", "New status: todo | in-progress | done (use with --edit)")
  .option("--description <text>", "New description for the task (use with --edit)")
  .action((dir: string, opts: {
    status?: string;
    edit?: string | boolean;
    title?: string;
    setStatus?: string;
    description?: string;
  }) => {
    // ── Edit mode ──────────────────────────────────────────────────────
    if (opts.edit !== undefined) {
      const taskId = typeof opts.edit === "string" ? opts.edit : undefined;
      const hasEdits = opts.title || opts.setStatus || opts.description;

      if (!taskId || !hasEdits) {
        let all = listTasks(dir);
        if (opts.status) all = all.filter((t) => t.status === opts.status);
        console.log(chalk.bold("proto tasks --edit — LLM Usage Instructions"));
        console.log();
        console.log("Edit a task:");
        console.log(chalk.cyan("  proto tasks [dir] --edit <task-id> [--title \"new title\"] [--set-status todo|in-progress|done] [--description \"new description\"]"));
        console.log();
        console.log("Examples:");
        console.log(chalk.dim("  proto tasks --edit abc12345 --set-status done"));
        console.log(chalk.dim("  proto tasks --edit abc12345 --title \"Updated title\" --description \"More detail\""));
        console.log();
        if (all.length === 0) {
          console.log(chalk.dim("No tasks found."));
        } else {
          console.log("Available tasks:");
          const colorMap: Record<string, (s: string) => string> = {
            todo: chalk.yellow,
            "in-progress": chalk.blue,
            done: chalk.green,
          };
          for (const task of all) {
            const colorFn = colorMap[task.status] || chalk.white;
            console.log(`  ${colorFn(`[${task.status}]`)} ${chalk.bold(task.id)} — ${task.title}`);
          }
        }
        return;
      }

      const updates: Partial<Pick<Task, "status" | "title" | "description">> = {};
      if (opts.title) updates.title = opts.title;
      if (opts.setStatus) updates.status = opts.setStatus as TaskStatus;
      if (opts.description) updates.description = opts.description;

      const updated = updateTask(dir, taskId, updates);
      if (!updated) {
        console.log(chalk.red(`Task not found: ${taskId}`));
        process.exitCode = 1;
        return;
      }
      console.log(chalk.green(`✓ Task updated: ${updated.title}`));
      console.log(chalk.dim(`  id: ${updated.id} | status: ${updated.status}`));
      return;
    }

    // ── List mode ──────────────────────────────────────────────────────
    let filtered = listTasksWithPaths(dir);

    if (opts.status) filtered = filtered.filter((t) => t.status === opts.status);

    if (filtered.length === 0) {
      console.log(chalk.dim("No tasks found."));
      return;
    }

    const statusColors: Record<string, (s: string) => string> = {
      todo: chalk.yellow,
      "in-progress": chalk.blue,
      done: chalk.green,
    };

    for (const task of filtered) {
      const colorFn = statusColors[task.status] || chalk.white;
      console.log(`  ${colorFn(`[${task.status}]`)} ${task.title}`);
      console.log(chalk.dim(`    id:       ${task.id}`));
      console.log(chalk.dim(`    file:     ${task.filePath}`));
      console.log(chalk.dim(`    selector: ${task.selector}`));
      if (task.cssSelector) console.log(chalk.dim(`    css:      ${task.cssSelector}`));
      if (task.url) console.log(chalk.dim(`    url:      ${task.url}`));
      if (task.screenshot) console.log(chalk.dim(`    screenshot: ${task.screenshot}`));
      console.log(chalk.dim(`    created:  ${task.created}`));
      if (task.updated) console.log(chalk.dim(`    updated:  ${task.updated}`));
      if (task.description) console.log(chalk.dim(`    ${task.description.slice(0, 120)}`));
      console.log();
    }

    const all = listTasks(dir);
    const todoCount = all.filter((t) => t.status === "todo").length;
    const inProgressCount = all.filter((t) => t.status === "in-progress").length;
    const doneCount = all.filter((t) => t.status === "done").length;
    console.log(
      chalk.dim(
        `  Total: ${all.length} | Todo: ${todoCount} | In Progress: ${inProgressCount} | Done: ${doneCount}`,
      ),
    );
  });

program.parse();

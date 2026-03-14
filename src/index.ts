import { Command } from "commander";
import { initProject } from "./commands/init.js";
import { attachProject } from "./commands/attach.js";
import { serve } from "./server/server.js";
import { exportFile, exportDirectory, exportTasks, isDirectory as isDir } from "./commands/export.js";
import { validateFile, validateDirectory, isDirectory as isDir2 } from "./commands/validate.js";
import { listTasks } from "./core/tasks.js";
import { writeFileSync } from "node:fs";
import chalk from "chalk";

const program = new Command();

program
  .name("proto")
  .description(
    "Prototype Studio — CLI tool for frontend prototyping with LLM assistance",
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
  .description("List all tasks in the project")
  .argument("[dir]", "Project root directory", ".")
  .option("--status <status>", "Filter by status (todo, in-progress, done)")
  .action((dir: string, opts: { status?: string }) => {
    let filtered = listTasks(dir);

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
      console.log(chalk.dim(`    selector: ${task.selector}`));
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

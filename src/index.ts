import { Command } from "commander";
import { initProject } from "./commands/init.js";
import { serve } from "./server/server.js";
import { exportFile, exportDirectory, isDirectory as isDir } from "./commands/export.js";
import { validateFile, validateDirectory, isDirectory as isDir2 } from "./commands/validate.js";
import { writeFileSync } from "node:fs";

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
    "Initialize project with annotation rules and Copilot instructions",
  )
  .argument("[dir]", "Target directory", ".")
  .action((dir: string) => {
    initProject(dir);
  });

program
  .command("serve")
  .description("Serve HTML prototype(s) with live annotation overlay")
  .argument("<target>", "HTML file or directory containing HTML files")
  .option("-p, --port <port>", "Port number", "3700")
  .option("--no-open", "Do not open browser automatically")
  .action(async (target: string, opts: { port: string; open: boolean }) => {
    await serve(target, {
      port: parseInt(opts.port, 10),
      open: opts.open,
    });
  });

program
  .command("export")
  .description(
    "Export annotated HTML file(s) as a ready-to-paste LLM prompt. Accepts a file or directory.",
  )
  .argument("<target>", "HTML file or directory of HTML files")
  .option("-c, --clipboard", "Copy to clipboard", false)
  .option("-o, --output <file>", "Write prompt to file")
  .action(
    async (
      target: string,
      opts: { clipboard: boolean; output?: string },
    ) => {
      let prompt: string;

      if (isDir(target)) {
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
    "Validate HTML prototype(s) against the annotation contract. Accepts a file or directory.",
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

program.parse();

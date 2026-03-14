import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { writeConfig } from "../core/config.js";
import { ensureTaskDirs } from "../core/tasks.js";
import type { ProtoConfig } from "../core/types.js";

export function attachProject(
  projectDir: string,
  url?: string,
): { files: string[] } {
  const created: string[] = [];

  const config: ProtoConfig = {
    mode: "attach",
    url: url || "http://localhost:3000",
    port: 3700,
  };

  writeConfig(projectDir, config);
  created.push(join(projectDir, ".proto", "config.json"));

  ensureTaskDirs(projectDir);
  created.push(join(projectDir, ".proto", "tasks"));
  created.push(join(projectDir, ".proto", "screenshots"));

  // Add .proto/screenshots to .gitignore
  const gitignorePath = join(projectDir, ".gitignore");
  const screenshotsEntry = ".proto/screenshots/";
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    if (!content.includes(screenshotsEntry)) {
      writeFileSync(
        gitignorePath,
        content.trimEnd() + "\n" + screenshotsEntry + "\n",
        "utf-8",
      );
    }
  } else {
    writeFileSync(
      gitignorePath,
      "node_modules/\n" + screenshotsEntry + "\n",
      "utf-8",
    );
    created.push(gitignorePath);
  }

  // Add proto scripts to existing package.json
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (!pkg.scripts) pkg.scripts = {};

    const protoScripts: Record<string, string> = {
      "proto:serve": "proto serve .",
      "proto:export": "proto export .",
      "proto:validate": "proto validate .",
    };

    let updated = false;
    for (const [name, cmd] of Object.entries(protoScripts)) {
      if (!pkg.scripts[name]) {
        pkg.scripts[name] = cmd;
        updated = true;
      }
    }

    if (updated) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    }
  }

  console.log(chalk.green("✓ Proto Studio attached to project"));
  console.log(chalk.dim(`  Mode: attach`));
  console.log(chalk.dim(`  URL: ${config.url}`));
  console.log(chalk.dim(`  Task server port: ${config.port}`));
  for (const f of created) {
    console.log(chalk.dim(`  created: ${f}`));
  }

  console.log();
  console.log(chalk.cyan("Next steps:"));
  console.log(
    chalk.dim("  1. Install Chrome extension from dist/chrome-extension/"),
  );
  console.log(chalk.dim("  2. Run: npm run proto:serve"));
  console.log(chalk.dim("  3. Navigate to your webapp and start annotating"));

  return { files: created };
}

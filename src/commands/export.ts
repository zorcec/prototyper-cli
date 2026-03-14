import { readFileSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import chalk from "chalk";
import { parseAnnotations, countAnnotationsByTag } from "../core/annotations.js";
import { findHtmlFiles } from "../core/html-parser.js";
import { listTasks } from "../core/tasks.js";
import type { ExportResult, DirectoryExportResult, TaskExportResult } from "../core/types.js";

const EXPORT_PREAMBLE = `You are reviewing an annotated HTML prototype. Each file contains inline
annotation comments that describe changes, additions, and constraints.

## Annotation Tags

| Tag | Meaning | Your Action |
|-----|---------|-------------|
| @TODO | Change needed | Implement the change, then REMOVE the comment |
| @FEATURE | New feature | Add at the indicated location, then REMOVE the comment |
| @VARIANT | Alternative version | Generate variant below original, keep both |
| @KEEP | Do not modify | Leave this element completely unchanged |
| @QUESTION | Question for you | Answer as a @CONTEXT comment |
| @CONTEXT | Background info | Read and use as design context, no direct action |

## Rules

1. Implement every @TODO and @FEATURE, then delete the annotation comment
2. NEVER modify elements marked @KEEP
3. Preserve ALL data-proto-id attributes — do not rename or remove them
4. Keep each file self-contained — OK to use CDN links (Tailwind, fonts, icons)
5. Keep navigation links consistent — use relative \`<a href="./page.html">\`
6. Write the complete updated file(s)

---

`;

export function exportFile(filePath: string): ExportResult {
  const absPath = resolve(filePath);
  const html = readFileSync(absPath, "utf-8");
  const annotations = parseAnnotations(html);
  const counts = countAnnotationsByTag(annotations);
  const name = basename(absPath);

  const prompt =
    EXPORT_PREAMBLE +
    `## Annotated File: \`${name}\`\n\n\`\`\`html\n${html}\n\`\`\``;

  console.log(chalk.green(`✓ Export ready for ${name}`));
  console.log(chalk.dim(`  Annotations: ${annotations.length}`));
  for (const [tag, count] of Object.entries(counts)) {
    if (count > 0) console.log(chalk.dim(`    @${tag}: ${count}`));
  }

  return { prompt, annotationCount: annotations.length, filePath: absPath };
}

export function exportDirectory(dirPath: string): DirectoryExportResult {
  const absPath = resolve(dirPath);
  const htmlFiles = findHtmlFiles(absPath);

  if (htmlFiles.length === 0) {
    throw new Error(`No HTML files found in directory: ${absPath}`);
  }

  const fileResults: Array<{
    name: string;
    html: string;
    annotationCount: number;
    filePath: string;
  }> = [];

  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf-8");
    const annotations = parseAnnotations(html);
    fileResults.push({
      name: basename(file),
      html,
      annotationCount: annotations.length,
      filePath: file,
    });
  }

  const totalAnnotations = fileResults.reduce(
    (sum, f) => sum + f.annotationCount,
    0,
  );

  const filesList = fileResults
    .map((f, i) => `${i + 1}. \`${f.name}\` (${f.annotationCount} annotations)`)
    .join("\n");

  const fileBlocks = fileResults
    .map(
      (f, i) =>
        `## File ${i + 1}/${fileResults.length}: \`${f.name}\`\n\n\`\`\`html\n${f.html}\n\`\`\``,
    )
    .join("\n\n---\n\n");

  const prompt =
    EXPORT_PREAMBLE +
    `## Multi-Page Prototype (${fileResults.length} files, ${totalAnnotations} total annotations)\n\n` +
    `### Files\n${filesList}\n\nProcess each file independently, preserving navigation links.\n\n---\n\n` +
    fileBlocks;

  console.log(
    chalk.green(
      `✓ Export ready for ${fileResults.length} files in ${basename(absPath)}/`,
    ),
  );
  console.log(chalk.dim(`  Total annotations: ${totalAnnotations}`));
  for (const f of fileResults) {
    console.log(chalk.dim(`  ${f.name}: ${f.annotationCount} annotations`));
  }

  return {
    prompt,
    files: fileResults.map((f) => ({
      filePath: f.filePath,
      annotationCount: f.annotationCount,
    })),
    totalAnnotations,
  };
}

export function getExportPreamble(): string {
  return EXPORT_PREAMBLE;
}

export function isDirectory(targetPath: string): boolean {
  try {
    return statSync(resolve(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

const TASK_EXPORT_PREAMBLE = `You are reviewing a project with annotated tasks. Each task describes a change,
feature, or question about a specific UI element identified by its CSS selector.

## Task Statuses

| Status | Meaning |
|--------|---------|
| todo | Not started — implement this |
| in-progress | Being worked on |
| done | Completed — skip |

## Task Tags

| Tag | Meaning | Your Action |
|-----|---------|-------------|
| TODO | Change needed | Implement the change |
| FEATURE | New feature | Add the feature |
| VARIANT | Alternative version | Generate alternative |
| KEEP | Do not modify | Leave unchanged |
| QUESTION | Question for you | Answer in your response |
| CONTEXT | Background info | Use as design context |

## Rules

1. Implement every TODO and FEATURE task with status "todo"
2. NEVER modify elements referenced by KEEP tasks
3. Preserve ALL data-proto-id attributes
4. Write the complete updated file(s)

---

`;

export function exportTasks(projectDir: string): TaskExportResult {
  const absPath = resolve(projectDir);
  const tasks = listTasks(absPath);
  const activeTasks = tasks.filter((t) => t.status !== "done");

  const taskBlocks = activeTasks
    .map(
      (t, i) =>
        `### Task ${i + 1}: [${t.tag}] ${t.title}\n` +
        `- **Status:** ${t.status}\n` +
        `- **Priority:** ${t.priority}\n` +
        `- **Selector:** \`${t.selector}\`\n` +
        (t.url ? `- **URL:** ${t.url}\n` : "") +
        (t.description ? `\n${t.description}\n` : ""),
    )
    .join("\n---\n\n");

  const prompt =
    TASK_EXPORT_PREAMBLE +
    `## Active Tasks (${activeTasks.length} of ${tasks.length} total)\n\n` +
    (activeTasks.length === 0 ? "No active tasks.\n" : taskBlocks);

  console.log(chalk.green(`✓ Export ready: ${activeTasks.length} active tasks`));
  console.log(chalk.dim(`  Total tasks: ${tasks.length}`));
  console.log(chalk.dim(`  Done: ${tasks.length - activeTasks.length}`));

  return { prompt, taskCount: activeTasks.length, tasks: activeTasks };
}

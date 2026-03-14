import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import chalk from "chalk";
import { ensureTaskDirs } from "../core/tasks.js";
import { writeConfig } from "../core/config.js";
import type { ProtoConfig } from "../core/types.js";

export const RULES_TEMPLATE = `# Prototype Studio — Annotation Contract

This document defines the rules that any LLM must follow when generating
HTML prototype files for use with Prototype Studio.

---

## 1. One Screen Per File

Each HTML file represents **one screen** of the application. Do not put
multiple pages in a single file.

Name files after their route:

\`\`\`
login.html
dashboard.html
settings.html
settings-profile.html
listings.html
listing-detail.html
\`\`\`

Between screens, use plain relative anchor links:

\`\`\`html
<a href="./dashboard.html">Go to Dashboard</a>
\`\`\`

---

## 2. Preferred Libraries (use via CDN)

These are explicitly allowed and preferred. Use them by loading from CDN
so prototypes look close to the real product with minimal markup.

### Tailwind CSS — primary styling

\`\`\`html
<script src="https://cdn.tailwindcss.com"></script>
\`\`\`

Use Tailwind utility classes for all layout, spacing, color, and typography.
Do not write \`<style>\` blocks if Tailwind covers the need.

### Lucide Icons

\`\`\`html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
\`\`\`

Use inline icon elements that Lucide replaces at runtime:

\`\`\`html
<i data-lucide="search" class="w-4 h-4"></i>
<script>lucide.createIcons();</script>
\`\`\`

### Google Fonts

\`\`\`html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
\`\`\`

Apply with a one-line style:

\`\`\`html
<style>body { font-family: 'Inter', sans-serif; }</style>
\`\`\`

### Other allowed CDN sources

- \`cdn.jsdelivr.net\` — any library
- \`unpkg.com\` — any library
- \`cdnjs.cloudflare.com\` — any library
- \`esm.sh\` — ES module imports

---

## 3. File Structure

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>App Name — Screen Name</title>
  <!-- CDN libraries here -->
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">

  <!-- Navigation (copy across pages, do not link to a shared file) -->
  <nav data-proto-id="main-nav" class="...">...</nav>

  <!-- Page content -->
  <main data-proto-id="main-content">...</main>

</body>
</html>
\`\`\`

---

## 4. Element Identification (\`data-proto-id\`)

Every meaningful UI element **must** carry a \`data-proto-id\` attribute.

\`\`\`html
<nav data-proto-id="main-nav">...</nav>
<aside data-proto-id="sidebar">...</aside>
<section data-proto-id="hero-section">...</section>
<form data-proto-id="login-form">...</form>
<button data-proto-id="cta-submit">Submit</button>
<div data-proto-id="card-listing-1">...</div>
\`\`\`

### Rules

1. **kebab-case** — \`hero-section\`, \`nav-primary\`, \`btn-submit\`
2. **Semantically meaningful** — describe what the element is
3. **Stable across iterations** — do not rename unless asked
4. **Unique per file** — no duplicates within a file
5. **Globally unique** — avoid the same ID in different pages so cross-page
   validation works
6. Apply to: sections, nav, headers, footers, forms, buttons, inputs,
   cards, modals, dialogs, and any element a reviewer might annotate

---

## 5. Annotation Comments

Annotations are embedded as HTML comments **directly above** the target element:

\`\`\`html
<!-- @TAG[data-proto-id="element-id"] Feedback text here -->
<element data-proto-id="element-id">...</element>
\`\`\`

### Tags and Meanings

| Tag | Meaning | LLM Action |
|-----|---------|------------|
| \`@TODO\` | Change this element | Implement, then remove the comment |
| \`@FEATURE\` | Add something new here | Add it, then remove the comment |
| \`@VARIANT\` | Alternative version | Generate below original, keep both |
| \`@KEEP\` | Do not modify | Skip entirely |
| \`@QUESTION\` | Question for you | Answer as a new \`@CONTEXT\` comment |
| \`@CONTEXT\` | Background info | Read silently, no direct action |

### Processing Rules

1. Implement every \`@TODO\` and \`@FEATURE\`, then **remove** the comment
2. Never touch elements marked \`@KEEP\`
3. For \`@VARIANT\`, add the alternative **below** the original inside
   \`<!-- VARIANT START -->\` / \`<!-- VARIANT END -->\` markers
4. For \`@QUESTION\`, write your answer back as a \`@CONTEXT\` comment
5. Preserve all \`data-proto-id\` attributes — never rename or remove them
6. New elements you add must also get \`data-proto-id\` values

---

## 6. Multi-Page Conventions

### Navigation pattern

Repeat the navigation component verbatim in every file (no shared includes):

\`\`\`html
<nav data-proto-id="main-nav" class="bg-white border-b px-6 py-3 flex items-center gap-6">
  <a href="./dashboard.html" class="font-semibold text-gray-900">App</a>
  <a href="./listings.html" class="text-gray-500 hover:text-gray-900">Listings</a>
  <a href="./settings.html" class="text-gray-500 hover:text-gray-900">Settings</a>
</nav>
\`\`\`

### Active state on current page

Use a distinct Tailwind class for the active link on each page:

\`\`\`html
<a href="./dashboard.html" class="font-semibold text-blue-600">Dashboard</a>
\`\`\`

### Shared visual language

Use the same color palette and spacing across all pages:
- Background: \`bg-gray-50\`
- Cards: \`bg-white rounded-xl shadow-sm border border-gray-100\`
- Primary action: \`bg-blue-600 hover:bg-blue-700 text-white\`
- Secondary action: \`border border-gray-300 hover:bg-gray-50\`
- Destructive: \`bg-red-600 hover:bg-red-700 text-white\`

---

## 7. What Not To Do

- Do not combine multiple screens into one file
- Do not create \`shared.css\` or \`components.html\` — repeat shared elements
- Do not use absolute URLs for navigation between pages; use \`./page.html\`
- Do not introduce JS frameworks (React, Vue, Alpine) unless asked
- Do not remove \`data-proto-id\` attributes
- Do not rename existing \`data-proto-id\` values
- Do not ignore \`@KEEP\` annotations
`;

export const COPILOT_RULES_TEMPLATE = `---
description: "Rules for generating HTML prototypes compatible with Prototype Studio"
applyTo: "**/*.html"
---

# Prototype Studio Rules

When generating HTML prototypes:

1. **One screen per file** — name files after their route (login.html, dashboard.html, etc.)
2. **Tailwind CSS via CDN** — add \`<script src="https://cdn.tailwindcss.com"></script>\` in head; use utility classes for all styling
3. **Lucide icons via CDN** — \`<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>\` and call \`lucide.createIcons()\`
4. **Google Fonts** — Inter via \`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap\`
5. **data-proto-id** (kebab-case, stable, unique per file and globally across files) on every meaningful element
6. **Navigation** — use relative \`<a href="./page.html">\` links; repeat nav verbatim in every file
7. **Process annotations** — implement \`@TODO\`/\`@FEATURE\` and remove them, never modify \`@KEEP\`, answer \`@QUESTION\` with \`@CONTEXT\`
8. Never rename or remove existing \`data-proto-id\` attributes

## CLI Task Commands

Use these CLI commands to manage tasks during development:

\`\`\`bash
# List all tasks
proto tasks .

# Filter by status
proto tasks . --status todo
proto tasks . --status in-progress
proto tasks . --status done

# Filter by tag or priority
proto tasks . --tag TODO
proto tasks . --priority high

# Archive done tasks (with optional reason)
proto archive . --reason "Sprint 1 complete"

# Archive all tasks
proto archive . --all --reason "Project complete"
\`\`\`
`;

const PACKAGE_JSON_TEMPLATE = JSON.stringify(
  {
    name: "prototypes",
    version: "1.0.0",
    description: "HTML prototypes managed with Prototype Studio",
    scripts: {
      serve: "proto serve .",
      export: "proto export .",
      validate: "proto validate .",
    },
  },
  null,
  2,
);

const STARTER_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>App — Home</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">

  <nav data-proto-id="main-nav" class="bg-white border-b px-6 py-3 flex items-center gap-6">
    <a href="./index.html" class="font-semibold text-blue-600">App</a>
  </nav>

  <main data-proto-id="main-content" class="max-w-4xl mx-auto px-6 py-8">

    <header data-proto-id="page-header" class="mb-8">
      <h1 data-proto-id="page-title" class="text-2xl font-semibold text-gray-900">Welcome</h1>
      <p data-proto-id="page-subtitle" class="text-gray-500 mt-1">Your prototype starts here.</p>
    </header>

    <section data-proto-id="hero-section" class="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
      <i data-lucide="layout" class="w-12 h-12 text-blue-600 mx-auto mb-4"></i>
      <h2 data-proto-id="hero-title" class="text-xl font-semibold mb-2">Start Prototyping</h2>
      <p data-proto-id="hero-description" class="text-gray-500 mb-6">Add your screens, annotate elements, and export to your LLM.</p>
      <button data-proto-id="cta-button" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
        Get Started
      </button>
    </section>

  </main>

  <script>lucide.createIcons();</script>
</body>
</html>
`;

const IMPLEMENTING_TASKS_PROMPT_TEMPLATE = `---
description: "Prompt template for implementing open prototype tasks"
mode: "agent"
---

# Implement Open Prototype Tasks

You are working on this HTML prototype project. Your goal is to implement all open (non-done) tasks.

## Step 1 — Review Open Tasks

Run the following command to see all open tasks:

\`\`\`bash
proto tasks . --status todo
proto tasks . --status in-progress
\`\`\`

Or export them as a full prompt:

\`\`\`bash
proto export . --tasks
\`\`\`

## Step 2 — Implement Each Task

For each task:
1. Find the HTML file containing the element with the given \`selector\`
2. Locate the element using its \`data-proto-id\` attribute
3. Implement the change described in the task
4. Preserve all existing \`data-proto-id\` attributes
5. Follow the rules in \`.github/instructions/prototype-studio.instructions.md\`

## Step 3 — Mark Tasks Done

After implementing each task, mark it done:

\`\`\`bash
# The CLI status filter helps you track progress
proto tasks . --status todo
\`\`\`

Use the Proto Studio overlay (Alt+S sidebar) or the task API to update task status.

## Rules

- Implement \`@TODO\` and \`@FEATURE\` tasks completely
- Skip tasks with status \`done\`  
- Preserve ALL \`data-proto-id\` attributes — never rename or remove them
- Keep navigation links consistent across pages
- Each file must remain self-contained (no shared CSS/JS files)
`;

export function initProject(targetDir: string): { files: string[] } {
  const created: string[] = [];

  // Create .proto/ task directories
  ensureTaskDirs(targetDir);
  const config: ProtoConfig = { mode: "prototype", port: 3700 };
  writeConfig(targetDir, config);
  created.push(join(targetDir, ".proto"));

  const rulesPath = join(targetDir, "prototype-rules.md");
  writeFileSync(rulesPath, RULES_TEMPLATE, "utf-8");
  created.push(rulesPath);

  const copilotDir = join(targetDir, ".github", "instructions");
  mkdirSync(copilotDir, { recursive: true });
  const copilotPath = join(copilotDir, "prototype-studio.instructions.md");
  writeFileSync(copilotPath, COPILOT_RULES_TEMPLATE, "utf-8");
  created.push(copilotPath);

  const promptPath = join(targetDir, ".github", "prompts", "implementing-tasks.prompt.md");
  mkdirSync(join(targetDir, ".github", "prompts"), { recursive: true });
  if (!existsSync(promptPath)) {
    writeFileSync(promptPath, IMPLEMENTING_TASKS_PROMPT_TEMPLATE, "utf-8");
    created.push(promptPath);
  }

  const pkgPath = join(targetDir, "package.json");
  if (!existsSync(pkgPath)) {
    writeFileSync(pkgPath, PACKAGE_JSON_TEMPLATE + "\n", "utf-8");
    created.push(pkgPath);
  }

  const gitignorePath = join(targetDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, "node_modules/\n.proto/screenshots/\n", "utf-8");
    created.push(gitignorePath);
  }

  const indexPath = join(targetDir, "index.html");
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, STARTER_HTML_TEMPLATE, "utf-8");
    created.push(indexPath);
  }

  console.log(chalk.green("✓ Prototype Studio initialized"));
  for (const f of created) {
    console.log(chalk.dim(`  created: ${f}`));
  }

  console.log();
  console.log(chalk.cyan("Installing dependencies..."));
  try {
    execSync("npm install", { cwd: targetDir, stdio: "inherit" });
    console.log(chalk.green("✓ Dependencies installed"));
  } catch {
    console.log(chalk.yellow("⚠ npm install failed — run it manually in your project directory"));
  }

  console.log();
  console.log(chalk.cyan("Ready! Start prototyping:"));
  console.log(chalk.dim("  npm run serve  (or: proto serve .)"));

  return { files: created };
}

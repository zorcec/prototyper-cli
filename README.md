# Prototype Studio

> Annotate HTML prototypes in the browser, export precise feedback to your LLM, iterate fast.

Prototype Studio is a CLI tool that sits between your LLM and your browser. It serves HTML prototype files with a live annotation layer, lets you click any element to leave typed feedback, and exports everything as a structured prompt ready to paste into Copilot, Claude, or any LLM.

---

## How it works

```
LLM generates HTML  →  proto serve  →  you annotate in browser
        ↑                                         ↓
  implements changes  ←  proto export  ←  structured prompt
```

1. **Serve** — the tool serves your HTML files with an invisible annotation layer injected
2. **Annotate** — click any element in the browser, type your feedback, tag it with intent
3. **Export** — one command assembles all annotations into a ready-to-paste LLM prompt
4. **Iterate** — the LLM updates the files, the browser reloads, you annotate again

---

## Installation

```bash
npm install -g prototype-studio
```

Or using **[yalc](https://github.com/wclr/yalc)** for local development:

```bash
cd prototyper-cli
npm run build
npx yalc publish

# In your target project:
npx yalc add prototype-studio
```

Or use without installing:

```bash
npx proto init .
```

---

## Quick start

```bash
# Initialize a new prototype project
npx proto init my-app

cd my-app

# Start the server and open in browser
npm run serve
```

`init` creates the full project structure and runs `npm install` for you:

```
my-app/
├── index.html                              # starter screen
├── package.json                            # serve / export / validate scripts
├── prototype-rules.md                      # annotation contract for your LLM
├── .gitignore
└── .github/
    └── instructions/
        └── prototype-studio.instructions.md   # Copilot workspace rules
```

---

## Commands

### `proto init [dir]`

Initialize a prototype project. Creates all scaffolding and runs `npm install`.

```bash
proto init .          # initialize in current directory
proto init my-app     # initialize in a new subdirectory
```

### `proto serve <target>`

Serve an HTML file or a directory of HTML files with live annotation overlay.

```bash
proto serve .                  # serve all HTML files in current directory
proto serve dashboard.html     # serve a single file
proto serve -p 4000 .          # custom port
proto serve --no-open .        # don't open browser automatically
```

### `proto export <target>`

Export annotated HTML as a structured LLM prompt.

```bash
proto export .                        # print to stdout
proto export . --clipboard            # copy to clipboard
proto export . --output prompt.txt    # write to file
proto export dashboard.html           # export single file
```

### `proto validate <target>`

Validate HTML files against the annotation contract.

```bash
proto validate .                              # validate all files in directory
proto validate dashboard.html                 # validate single file
proto validate dashboard.html --previous old.html   # check no IDs were dropped
```

---

## Annotation tags

Annotations are HTML comments placed directly above the element they describe:

```html
<!-- @TODO[data-proto-id="hero-section"] Make the heading larger and add a subtitle -->
<section data-proto-id="hero-section">...</section>
```

| Tag | Meaning | LLM action |
|---|---|---|
| `@TODO` | Change this element | Implement and remove the comment |
| `@FEATURE` | Add something new here | Add it and remove the comment |
| `@VARIANT` | Generate an alternative version | Add below original, keep both |
| `@KEEP` | Do not touch this element | Skip entirely |
| `@QUESTION` | Ask the LLM something | Answer as a `@CONTEXT` comment |
| `@CONTEXT` | Background information | Read silently, no action |

---

## Writing prototypes

Each HTML file is one screen. Use Tailwind CSS, Lucide icons, and Google Fonts via CDN — the annotation contract (written to your project by `proto init`) tells your LLM to use exactly these libraries.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>App — Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">

  <nav data-proto-id="main-nav" class="bg-white border-b px-6 py-3 flex items-center gap-6">
    <a href="./dashboard.html" class="font-semibold text-blue-600">App</a>
    <a href="./listings.html" class="text-gray-500 hover:text-gray-900">Listings</a>
  </nav>

  <main data-proto-id="main-content" class="max-w-4xl mx-auto px-6 py-8">
    <h1 data-proto-id="page-title" class="text-2xl font-semibold">Dashboard</h1>
  </main>

  <script>lucide.createIcons();</script>
</body>
</html>
```

**Rules:**
- One file per screen — name after the route (`login.html`, `dashboard.html`)
- Every meaningful element gets a `data-proto-id` — kebab-case, globally unique across files
- Navigate between pages with relative links: `<a href="./page.html">`
- Repeat navigation verbatim on every page (no shared includes)

---

## Multi-page projects

Point `serve`, `export`, and `validate` at a directory and they handle all HTML files together:

```bash
proto serve .          # all screens accessible in browser
proto export .         # all files bundled into one LLM prompt
proto validate .       # per-file checks + cross-file duplicate ID detection
```

---

## LLM workflow example

1. Ask Copilot or Claude to generate a screen:
   > *"Generate a login screen following the rules in prototype-rules.md"*

2. Serve and review:
   ```bash
   proto serve .
   ```

3. Annotate elements in the browser, then export:
   ```bash
   proto export . --clipboard
   ```

4. Paste into your LLM:
   > *(paste prompt)*
   > *"Implement all annotations"*

5. The LLM writes back to disk. Your browser reloads automatically.

6. Validate the result:
   ```bash
   proto validate .
   ```

---

## npm scripts (generated by `proto init`)

| Script | Command |
|---|---|
| `npm run serve` | `proto serve .` |
| `npm run export` | `proto export .` |
| `npm run validate` | `proto validate .` |

---

## License

MIT

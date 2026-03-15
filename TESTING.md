# Proto Studio — Testing Guide

## Running tests

### Unit tests
```bash
npx vitest run
# or with coverage:
npx vitest run --coverage
```

### E2E tests
```bash
npx vitest run --config vitest.e2e.config.ts
```

### Playwright tests (Chrome extension)
```bash
npx vitest run --config vitest.pw.config.ts
```

---

## Feature coverage

| Feature | Unit | E2E |
|---|---|---|
| `proto init` — scaffold new project | ✅ `tests/unit/init.test.ts` | ✅ `tests/e2e/init.test.ts` |
| `proto attach` — attach to existing project | ✅ `tests/unit/attach.test.ts` | — |
| `proto serve <target>` — serve HTML with overlay | — | ✅ `tests/e2e/serve.test.ts` |
| `proto serve` (API-only, no target) — for existing hosted apps | — | ✅ `tests/e2e/serve.test.ts` (API-only suite) |
| `proto export` — export tasks/annotations as LLM prompt | ✅ `tests/unit/export.test.ts` | ✅ `tests/e2e/export.test.ts` |
| `proto validate` — validate HTML files | ✅ `tests/unit/validate.test.ts` | ✅ `tests/e2e/validate.test.ts` |
| Task API — CRUD for tasks | — | ✅ `tests/e2e/serve.test.ts` |
| Screenshot upload / delete | — | ✅ `tests/e2e/serve.test.ts` |
| HTML parser / overlay injection | ✅ `tests/unit/html-parser.test.ts` | — |
| Overlay client script | ✅ `tests/unit/overlay.test.ts` | ✅ `tests/playwright/overlay.test.ts` |
| **Overlay on existing app (cross-origin / API-only)** | — | ✅ `tests/playwright/existing-app.test.ts` |
| Chrome extension | — | ✅ `tests/playwright/extension.test.ts` |
| Annotation contract | ✅ `tests/unit/contract.test.ts` | — |
| Config read/write | ✅ `tests/unit/config.test.ts` | — |
| Tasks core (CRUD, list/filter) | ✅ `tests/unit/tasks.test.ts` | — |
| Page-specific overlay dots (filter by `location.pathname`) | ✅ `tests/unit/overlay.test.ts` | — |
| Sidebar URL filtering (`pageTasks`, "N tasks on other pages" hint) | ✅ `tests/unit/overlay.test.ts` | ✅ `tests/e2e/serve.test.ts` |
| Edit modal button design (`btn-primary`, `btn-ghost`, `btn-screenshot`) | ✅ `tests/unit/overlay.test.ts` | — |
| Screenshot UI in modal (hover-to-reveal remove overlay, sidebar thumbnail) | ✅ `tests/unit/overlay.test.ts` | — |
| Screenshot visible in indicator tooltip | ✅ `tests/unit/overlay.test.ts` | — |
| Screenshot hover-to-remove overlay in sidebar (no edit modal required) | ✅ `tests/unit/overlay.test.ts` | — |
| Task card click opens edit modal directly (no Edit button needed) | ✅ `tests/unit/overlay.test.ts` | — |
| `data-testid` / `id` anchor in CSS selector (`buildElementSelector`) | ✅ `tests/unit/overlay.test.ts` | — |
| Page / variant switcher (`GET /api/pages` + `renderPageSwitcher`) | ✅ `tests/unit/overlay.test.ts` | ✅ `tests/e2e/serve.test.ts` |
| `proto tasks` — show full YAML front matter | — | ✅ `tests/e2e/serve.test.ts` |
| `proto tasks --edit` — LLM-friendly task editing | — | ✅ `tests/e2e/init.test.ts` |
| `proto tasks` — output includes full file path (regression) | — | ✅ `tests/e2e/init.test.ts` |
| `proto tasks --edit --status` — filter available tasks in edit mode (regression) | — | ✅ `tests/e2e/init.test.ts` |
| `cssSelector` field in task front matter (stores CSS path alongside selector) | ✅ `tests/unit/tasks.test.ts` | ✅ `tests/e2e/init.test.ts`, `tests/e2e/serve.test.ts` |
| `listTasksWithPaths` — returns tasks with file paths | ✅ `tests/unit/tasks.test.ts` | — |
| Console logs on task create/update/delete via API | — | ✅ `tests/e2e/serve.test.ts` |
| Screenshot URLs use absolute `SCREENSHOTS_URL` (fixes cross-origin display) | ✅ `tests/unit/overlay.test.ts` | ✅ `tests/e2e/serve.test.ts` |
| `buildCssPath` — always computes CSS path independent of test-id | ✅ `tests/unit/overlay.test.ts` | — |
| Click/contextmenu use `e.target` directly (fixes all tasks same selector bug) | ✅ `tests/unit/overlay.test.ts` | — |
| Sidebar shows ALL tasks across all pages (not just current page) | ✅ `tests/unit/overlay.test.ts` | ✅ `tests/e2e/serve.test.ts` |
| Sidebar shows URL badge for tasks from other pages | ✅ `tests/unit/overlay.test.ts` | — |
| SPA navigation detection (pushState/replaceState monkey-patch + popstate) | ✅ `tests/unit/overlay.test.ts` | ✅ `tests/e2e/serve.test.ts` |
| Chrome extension `captureVisibleTab` — proper promise API without null windowId | — | — |
| Package renamed from `prototype-studio` to `proto-studio` | — | — |
| Full-screen task edit modal (2-tab: Edit + Preview) | ✅ `tests/unit/overlay.test.ts` | — |
| Markdown renderer (`renderMarkdown`) | ✅ `tests/unit/overlay.test.ts` | — |
| Overlay indicators hidden for off-screen elements (viewport check) | ✅ `tests/unit/overlay.test.ts` | — |
| Single-task indicator click opens edit modal directly | ✅ `tests/unit/overlay.test.ts` | — |
| Multi-task indicator click pins tooltip for task selection | ✅ `tests/unit/overlay.test.ts` | — |
| Regression: `pageRoutes is not defined` crash (dir mode) | — | ✅ `tests/e2e/serve.test.ts` |
| Regression: overlay `Unexpected token ','` SyntaxError | ✅ `tests/unit/overlay.test.ts` | ✅ `tests/e2e/serve.test.ts` |

---

## API-only mode (existing hosted projects)

`proto serve` without a target starts the task API server only ($PORT default 3700).
The Chrome extension connects to this server and annotates any page served by your
existing dev stack. Tests for this mode live in the **"API-only mode"** `describe`
block in `tests/e2e/serve.test.ts`.

Covered scenarios:
- Server starts, `/api/tasks` returns `200`
- Create, update, delete tasks via the API
- `/` route returns `404` (no HTML served)
- `.proto/` directories are created in `process.cwd()`

---

## Overlay on existing app — full Playwright suite

`tests/playwright/existing-app.test.ts` starts two servers (simulated existing app
on one port, Proto Studio API on another) and injects the overlay cross-origin,
verifying every feature works flawlessly when Proto Studio is used with a live app.

Covered scenarios (23 tests):
- Overlay mounts on an existing-app page (shadow root created)
- CORS: `GET /api/tasks` and `POST /api/tasks` succeed from a different origin
- CORS: `OPTIONS` preflight returns `204` with `Access-Control-Allow-Origin: *`
- `Alt+A` enables annotation mode; status bar text updates
- Clicking an element with **only an `id`** (no `data-proto-id`/`data-testid`) opens popover
- Popover label shows the auto-generated CSS selector for the clicked element
- Saving via popover succeeds and shows "saved" in status bar
- Escape exits annotation mode
- Annotating elements with `data-testid` attribute
- Annotating elements with `data-proto-id` attribute
- `Alt+S` opens the task sidebar
- Sidebar shows all created tasks with correct task count
- Edge-trigger hover opens the sidebar
- Escape closes the sidebar
- Right-click opens context menu **on any element** (no attribute required)
- Context menu shows single "Annotate" option (task types removed)
- Marking a task done updates the sidebar status badge
- Annotation mode sets `cursor: crosshair` on page elements
- Clicking inside overlay UI during annotation mode does NOT create a task

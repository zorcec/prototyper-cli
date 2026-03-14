# Prototype Studio — Testing Guide

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
| Tasks core (CRUD, archive, list/filter) | ✅ `tests/unit/tasks.test.ts` | — |

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
- Context menu lists TODO / FEATURE / QUESTION options
- Marking a task done updates the sidebar status badge
- Annotation mode sets `cursor: crosshair` on page elements
- Clicking inside overlay UI during annotation mode does NOT create a task

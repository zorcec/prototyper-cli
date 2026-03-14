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

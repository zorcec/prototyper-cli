# Task Analysis and LLM Context Improvements

**Date:** March 14, 2026  
**Analysis:** Task clarity assessment and recommendations for better LLM-understandable context.

---

## Executive Summary

The HomeFinder AI project uses `prototype-studio` to capture UI-level tasks directly from the browser. While this enables fast annotation, **tasks currently lack essential context that LLMs (Copilot, Claude) need to understand where and how to implement changes**.

**Problem:** 8 TODO tasks exist with:
- ✅ UI location (URL + CSS selector)
- ❌ No file/component paths
- ❌ No technical requirements
- ❌ No acceptance criteria
- ❌ No priority or effort estimates

**Solution:** Enhance task descriptions with structured metadata that bridges UI-level feedback to code-level implementation.

---

## Current Task Metadata

### What prototype-studio captures
```yaml
id: unique-id
status: todo|in-progress|done
title: "..."
description: "..."
url: "/page-path"
selector: "CSS-selector-to-element"
screenshot: "optional-image.png"
created: ISO-8601-timestamp
```

### What's missing for LLMs
- **Related files**: Which source files need changes
- **Components**: Which React/Node components are involved
- **DB schema**: Which tables need schema changes
- **API changes**: Which tRPC routers need updates
- **Acceptance criteria**: How to verify the task is done
- **Effort estimate**: T-shirt size (XS, S, M, L, XL)
- **Priority**: High/Medium/Low
- **Dependencies**: What must be done first
- **Technical notes**: Implementation details and constraints

---

## Enhanced Task Template

Recommend enriching task descriptions with a structured YAML header appended to task bodies:

```markdown
# Task Title

## UI Context
- URL: /settings
- Selector: main.flex-1 > div.flex > ... (fragile, don't rely on this)
- Screenshot: [if available]

## Code Changes Required
- **Files to modify:**
  - `src/app/(dashboard)/settings/page.tsx` (UI component)
  - `src/server/trpc/routers/metrics.ts` (API endpoint for adding metric)
  - `src/server/db/schema.ts` (if new table/column needed)

- **Components involved:**
  - `MetricsTab` (in settings page)
  - `MetricForm` (new component or extend existing)
  - tRPC router: `metrics.create()`

- **DB schema changes:** None / New `metric_presets` table / Add `custom_metrics` JSON column

## Acceptance Criteria
- [ ] Can add new image metric via UI button
- [ ] New metric stored in database
- [ ] Metric appears in metrics list
- [ ] Metric can be deleted
- [ ] Only valid metrics names accepted (regex validation)

## Technical Notes
- Use existing form component patterns from models-tab.tsx
- Image metrics API should accept: name (string), prompt (string), enabled (boolean)
- Consider pagination if metrics list grows >50 items

## Dependencies
- None (can start immediately)

## Effort Estimate
- T-shirt: Medium (2-3 hours)
- Priority: High (blocks image analysis workflow)
```

---

## Current Tasks Analysis

### Task 1: Add a way to add new metrics (ID: 15908d24)
**URL:** `/settings`  
**Status:** TODO

#### Current Description
```
An add button to add new image metrics that will be calculated.

Values:
- name
- prompt
- edit
- delete
- on crawl as b
```

#### Issues
- ⚠️ Values list is incomplete/unclear
- ⚠️ No mention of which database to modify
- ⚠️ No mention of API changes

#### LLM-Friendly Enhancement
```markdown
## Code Changes
- **UI:** `src/app/(dashboard)/settings/_components/metrics-tab.tsx` 
  - Add "Add Metric" button that opens form modal
  - Form fields: name (text), prompt (textarea), runOnCrawl (checkbox)
  
- **API:** `src/server/trpc/routers/metrics.ts`
  - Add `createMetric()` procedure
  - Add validation: name must match regex /^[a-zA-Z0-9_-]{3,50}$/
  
- **DB Schema:** `src/server/db/schema.ts`
  - Ensure `image_metrics` table has columns:
    - id (primary)
    - name (string, unique)
    - prompt (text)
    - runOnCrawl (boolean)
    - createdAt (timestamp)

## Acceptance Criteria
- [ ] "Add Metric" button renders in Metrics tab
- [ ] Clicking button opens form modal
- [ ] Form validation works (name required, prompt required)
- [ ] Submitting creates new row in image_metrics table
- [ ] New metric appears in metrics list immediately
- [ ] Form resets after successful submit
- [ ] e2e test: test adding, editing, deleting a metric

## Related Code
- Use `api.metrics.list` to fetch current metrics
- Use `api.metrics.create` to add new metric
- Reference `MetricsTab` component for layout patterns
```

**Effort:** Small (2-3 hours) | **Priority:** High

---

### Task 2: Add feature to prune the DB (ID: e06aa292)
**URL:** `/settings`  
**Status:** TODO

#### Current Description
```
This option should remove all what is selected from the db. Possible options:
- properties
- profiles
- ....
```

#### Issues
- ⚠️ Database tables not clearly enumerated
- ⚠️ No mention of cascading deletes / data integrity concerns
- ⚠️ No confirmation/safety checks described
- ⚠️ Incomplete list ("....?")

#### LLM-Friendly Enhancement
```markdown
## Code Changes
- **UI:** `src/app/(dashboard)/settings/page.tsx`
  - Add "Database Management" section
  - Checkboxes for each prunable entity:
    - [ ] Delete all properties
    - [ ] Delete all profiles
    - [ ] Delete all crawl jobs
    - [ ] Delete all change history (property_price_changes table)
  - "Prune Selected" button with confirmation modal
  - Show row counts for each entity as warning

- **API:** `src/server/trpc/routers/settings.ts`
  - Add `pruneData()` procedure accepting object:
    ```ts
    { properties: boolean, profiles: boolean, crawlJobs: boolean, changeHistory: boolean }
    ```
  - Execute DELETE queries with CASCADE where applicable
  - Return deleted counts: `{ propertiesDeleted: N, profilesDeleted: N, ... }`
  - Add confirmation token to prevent accidental deletes

- **DB Schema:** Review existing constraints in schema.ts
  - properties table: CHECK constraints on required fields
  - Ensure CASCADE deletes are set on foreign keys from rules_table, change_history, etc.

## Cascading Deletes
- Deleting profiles → should cascade to profile_scores? (check schema)
- Deleting properties → should cascade to image_analysis, change_history
- Deleting crawl_jobs → should only clear job records, not affect properties

## Acceptance Criteria
- [ ] Prune UI section renders in Settings page
- [ ] Row counts display for each entity
- [ ] Confirmation modal appears before prune
- [ ] Prune executes without errors
- [ ] Verify deleted rows via Drizzle Studio
- [ ] Transaction rolls back if any delete fails
- [ ] e2e test: test pruning each entity type

## Safety Notes
- NEVER allow cascading delete of ALL data without explicit confirmation
- Consider adding a --dry-run mode to preview deletes
- Consider backup/restore before prune
```

**Effort:** Medium (4-5 hours) | **Priority:** Medium

---

### Task 3: Full width in profiles (ID: e35a456f)
**URL:** `/profiles`  
**Status:** TODO

#### Current Description
```
Make the layout responsive; if 3 boxes fit in a row, there should be 3 in a row! 
Right now, it splits in a non-optimal way.
```

#### Issues
- ✅ Clear intent
- ⚠️ No mention of breakpoints/screen sizes
- ⚠️ No mention of expected column counts at each breakpoint

#### LLM-Friendly Enhancement
```markdown
## Code Changes
- **Component:** `src/app/(dashboard)/profiles/page.tsx`
  - Replace current `grid` `className` with responsive Tailwind grid
  - Current likely: `grid-cols-1` or hardcoded width
  - Desired breakpoints:
    - Mobile (sm): 1 column
    - Tablet (md): 2 columns
    - Desktop (lg, xl): 3 columns
    - UltraWide (2xl+): 4 columns (max)

## Implementation
```tsx
// Current: <div className="grid grid-cols-1 gap-4">
// Change to:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
```

- Verify gap-4 is appropriate at all breakpoints
- Check if profile cards need max-width constraint
- Ensure no overflow at ultra-wide screens

## Acceptance Criteria
- [ ] 1 column on mobile (< 768px)
- [ ] 2 columns on tablet (768px - 1024px)
- [ ] 3 columns on desktop (1024px - 1536px)
- [ ] 4 columns on ultra-wide (>1536px)
- [ ] No horizontal scroll on any breakpoint
- [ ] Profile card content doesn't overflow
- [ ] Manual test: resize browser and verify layout
- [ ] e2e test: screenshot at different breakpoints (Playwright)

## Related Files
- Layout is likely in profiles page
- Check parent container max-width constraints
- Verify Tailwind config has breakpoints defined
```

**Effort:** XSmall (30 min) | **Priority:** Low (UI polish)

---

### Task 4: Image analyzer threshold (ID: 611cfd65)
**URL:** `/settings`  
**Status:** TODO

#### Current Description
```
Add a slider from 0-100 to set the analyzing threshold, and move it from general into metrics.
```

#### Issues
- ⚠️ No mention of what "threshold" controls (confidence? match confidence?)
- ⚠️ No mention of which algorithms use this threshold
- ⚠️ No mention of default value or recommended range

#### LLM-Friendly Enhancement
```markdown
## Code Changes
- **UI:** `src/app/(dashboard)/settings/_components/metrics-tab.tsx`
  - Move threshold slider from General tab to Metrics tab
  - Add slider component (0-100)
  - Show current value label
  - Add description: "Minimum confidence score (0-100) for LLM analysis results"

- **Current location:** Likely in `src/app/(dashboard)/settings/page.tsx` General section
  - Remove from there

- **API:** `src/server/trpc/routers/settings.ts`
  - Add `setAnalysisThreshold()` procedure: `{ threshold: number }` (0-100)
  - Validate: `if (threshold < 0 || threshold > 100) throw error`
  - Store in `app_settings` table: key = `analysis_threshold`, value = JSON number

- **Usage:** `src/server/services/image-analyzer.ts`
  - On LLM analysis result, filter results where confidence < threshold
  - Update `analyzeImage()` to use this threshold when processing results

## Acceptance Criteria
- [ ] Slider renders in Metrics tab alongside image metrics
- [ ] Slider value persists to database (app_settings)
- [ ] Threshold value displays next to slider (e.g., "65/100")
- [ ] Changing slider updates app_settings in real-time
- [ ] Image analyzer respects threshold on next analysis
- [ ] Default value is 50
- [ ] Slider validation prevents values < 0 or > 100
- [ ] e2e test: change threshold, verify it persists

## Related Code
- Settings API: `src/server/trpc/routers/settings.ts`
- App settings table: `src/server/db/schema.ts` (app_settings table)
- Image analysis: `src/server/services/image-analyzer.ts`
```

**Effort:** Small (2-3 hours) | **Priority:** Medium

---

### Task 5: Improve UI (ID: aa9f932c)
**URL:** `/settings`  
**Status:** TODO

#### Current Description
```
Align the missing only and analyze to the right side, make it minimalistic and good looking. 
Also make image metrics and...
```

#### Issues
- 🔴 **Incomplete description** ("and...")
- ⚠️ Unclear which buttons/components need alignment
- ⚠️ No design reference or mock-up

#### Action Needed
**This task needs to be re-annotated.** The description is incomplete. Recommend:
1. Go back to `/settings` page in browser
2. Re-click this element and complete the description
3. Or ask the user for clarification

#### Temporary LLM Context
```markdown
## Status: BLOCKED - Incomplete Description

Cannot proceed until task description is complete. 
Last known text fragment: "Align the missing only and analyze to the right side..."

## Likely Related Components
- Button alignment in settings tabs (General, Models, Metrics)
- "Missing Only" checkbox or toggle
- "Analyze" or "Run Analysis" button
- Likely component: `src/app/(dashboard)/settings/page.tsx`

## Next Steps
- Re-open `/settings` in browser
- Click the relevant element/button again
- Complete the task description in the form that appears
- Run `npx proto tasks --status todo` again to refresh
```

**Status:** 🔴 BLOCKED | **Effort:** Unknown (need clarification) | **Priority:** Unknown

---

### Task 6: Location scoring recalculation (ID: d7a082a6)
**URL:** `/settings`  
**Status:** TODO

#### Current Description
```
Add a way to manually trigger it, also with the checkbox to run only on the 
properties that don't have it yet. When prop...
```

#### Issues
- 🔴 **Incomplete description** ("When prop...")
- ⚠️ Unclear what "location scoring recalculation" entails
- ⚠️ Checkbox behavior not fully specified

#### LLM-Friendly Enhancement (Provisional)
```markdown
## Code Changes
- **UI:** `src/app/(dashboard)/settings/page.tsx` or separate Location Scoring tab
  - Add "Recalculate Location Scores" button
  - Add checkbox: "Only for properties missing scores"
  - Add progress indicator or toast notification on completion
  - Show last recalculation timestamp

- **API:** `src/server/trpc/routers/location-scoring.ts`
  - Add `recalculateScores()` procedure
  - Accept options: `{ onlyMissing: boolean }`
  - If onlyMissing: WHERE poi_score IS NULL
  - Return: `{ recalculatedCount: number, totalCount: number, durationMs: number }`

- **Service:** `src/server/services/scoring.ts` (or create dedicated location-scoring service)
  - Implement location score calculation logic
  - May need to fetch POIs, calculate distances, apply weights from `location_scoring_config`

## Acceptance Criteria
- [ ] "Recalculate" button renders (likely in Location Scoring section)
- [ ] Checkbox "Only missing" toggles state
- [ ] Clicking button starts recalculation process
- [ ] UI shows progress (spinner or counter)
- [ ] Task completes without error
- [ ] Scores updated in database
- [ ] Toast notification shows result: "Recalculated X properties in Y seconds"
- [ ] e2e test: verify scores update after recalculation

## Questions (for user)
- What POI types are included in location scoring? (transit, shops, parks, etc.)
- What is the formula for location score? (weighted sum of POI distances?)
- Should this run in background or block UI?
```

**Status:** ⚠️ INCOMPLETE | **Effort:** Medium (3-4 hours) | **Priority:** Unknown

---

### Task 7: Make all screens content full width (ID: 1edd1055)
**URL:** `/settings`  
**Status:** TODO

#### Current Description
```
General, Models, Metrics tab, also check all other paged
```

#### Issues
- ⚠️ Incomplete ("also check all other paged")
- ⚠️ Likely related to Task 3 (responsive layout)
- ⚠️ Unclear if "full width" means remove max-width constraint

#### LLM-Friendly Enhancement
```markdown
## Code Changes
- **Pages to update:**
  - `src/app/(dashboard)/settings/page.tsx` (General, Models, Metrics tabs)
  - `src/app/(dashboard)/map/page.tsx`
  - `src/app/(dashboard)/properties/page.tsx`
  - `src/app/(dashboard)/profiles/page.tsx`
  - `src/app/(dashboard)/crawl/page.tsx`
  - `src/app/(dashboard)/models/page.tsx`
  - `src/app/(dashboard)/location-scoring/page.tsx`
  - `src/app/(dashboard)/changes/page.tsx`

- **Current issue:** Likely `max-w-2xl` or `max-w-4xl` constraint on main content div
- **Change to:** Remove max-width or use larger value (e.g., `max-w-7xl`)
- **Consider:** Add horizontal padding on small screens to avoid edge-to-edge content

## Implementation Pattern
```tsx
// Before:
<div className="max-w-2xl mx-auto">

// After:
<div className="mx-auto px-4 sm:px-6">
// or
<div className="w-full">
```

## Acceptance Criteria
- [ ] All dashboard pages extend to full width
- [ ] Content doesn't touch screen edges on small screens (padding added)
- [ ] No horizontal scroll on any screen size
- [ ] Tab content in settings fills available width
- [ ] Manual test: screenshot each page at 1920x1080 resolution
- [ ] e2e test: verify no horizontal scroll

## Related Task
- Related to Task 3 (responsive columns) — coordinate changes
```

**Effort:** Small (1-2 hours) | **Priority:** Medium (UI polish)

---

### Task 8: The "main" profile position correction (ID: 066583cc)
**URL:** `/profiles`  
**Status:** TODO

#### Current Description
```
It should be always on the first position
```

#### Issues
- ✅ Clear intent
- ⚠️ Need to understand what "main" profile means
- ⚠️ No mention of if this is sorting or hardcoding the position

#### LLM-Friendly Enhancement
```markdown
## Code Changes
- **UI Logic:** `src/app/(dashboard)/profiles/page.tsx`
  - When fetching profiles, sort so "main" profile appears first
  - Profiles API: `api.profiles.list`
  - Add client-side sort or modify API to return main profile first

- **Alternative (if main profile is flagged in DB):**
  - `src/server/trpc/routers/profile.ts`
  - Modify `list()` procedure to sort by: `isMain DESC, createdAt DESC`
  - Ensure exactly one profile has `isMain = true`

- **DB schema check:** `src/server/db/schema.ts`
  - Verify `profiles` table has a field that marks "main" profile
  - Could be boolean `isMain` or string `mainProfileId` in app_settings

## Implementation Options
A) Hardcode main profile position in UI:
```tsx
const [mainProfile] = profiles.filter(p => p.isMain);
const otherProfiles = profiles.filter(p => !p.isMain);
const sortedProfiles = mainProfile ? [mainProfile, ...otherProfiles] : profiles;
```

B) Modify API to return in order:
```ts
// In profiles.ts router.list()
.query(async ({ ctx }) => {
  return ctx.db.select().from(schema.profiles)
    .orderBy(asc(schema.profiles.isMain), desc(schema.profiles.createdAt))
})
```

## Acceptance Criteria
- [ ] Main profile appears in first position in grid
- [ ] Main profile remains main even after page refresh
- [ ] If only one profile exists, it displays first regardless
- [ ] Manual test: create 3+ profiles, set one as main, verify position
- [ ] e2e test: verify main profile is at index 0 in DOM

## Questions
- How is "main" profile currently identified? (isMain field? database logic?)
- Should switching profiles update which one is "main"?
```

**Effort:** XSmall (30 min) | **Priority:** Low (UX polish)

---

## Summary: Current Tasks Status

| ID | Title | Status | Effort | Priority | Clarity |
|---|---|---|---|---|---|
| 15908d24 | Add new metrics | TODO | M | High | ⚠️ Partial |
| e06aa292 | Prune DB | TODO | M | Medium | ⚠️ Incomplete |
| e35a456f | Full width profiles | TODO | XS | Low | ✅ Clear |
| 611cfd65 | Image analyzer threshold | TODO | S | Medium | ⚠️ Vague |
| aa9f932c | Improve UI | TODO | ? | ? | 🔴 **Blocked** |
| d7a082a6 | Location recalculation | TODO | M | ? | 🔴 **Blocked** |
| 1edd1055 | Full width all screens | TODO | S | Medium | ⚠️ Incomplete |
| 066583cc | Main profile position | TODO | XS | Low | ✅ Clear |

**Legend:**
- ✅ Clear — Ready to start
- ⚠️ Partial/Vague — Can start but may need clarification mid-task
- 🔴 Blocked — Cannot start until task description is completed

---

## Recommendations for Improvement

### 1. **Enhance Task Template**

Add structured metadata to task descriptions. Update `.proto/prototype-rules.md` to include:

```markdown
## Task Structure (Recommended)

When creating a task, include these sections in the description:

### Code Context
- Files to modify: [list]
- Components involved: [list]
- DB changes: Yes/No

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Effort Estimate
- T-shirt size: XS / S / M / L / XL

### Priority
- High / Medium / Low
```

### 2. **Pre-Annotation Review Checklist**

Before annotating in the UI, complete this checklist:

- [ ] Task description is complete (no "and..." or truncation)
- [ ] Task title is specific (not just "Fix button")
- [ ] Acceptance criteria are clear
- [ ] Which files need to change? (add to description)
- [ ] Dependencies on other tasks? (mention them)
- [ ] Effort estimate added?

### 3. **Bridge UI Tasks to Code Context**

Extend the Task interface to support:

```ts
interface TaskEnhanced extends Task {
  // Code context
  filesToModify?: string[];      // e.g., ["src/app/(dashboard)/settings/page.tsx"]
  componentsInvolved?: string[]; // e.g., ["MetricsTab", "MetricForm"]
  dbSchemaChanges?: string;      // e.g., "Add column to image_metrics table"
  
  // Planning
  acceptanceCriteria?: string[]; // [ "Can add metric", "Metric persists", ... ]
  effortEstimate?: "XS" | "S" | "M" | "L" | "XL";
  priority?: "Low" | "Medium" | "High";
  dependencies?: string[];       // IDs of dependent tasks
  
  // LLM Context
  technicalNotes?: string;       // Implementation details, constraints
  relatedCode?: string[];        // Links to similar patterns in codebase
}
```

### 4. **Create Task Export for LLMs**

Add a command: `npx proto tasks --export-for-llm [id]`

Output format:
```markdown
# [Task Title]

## URL & Location
- Page: [URL]
- Element: [selector]

## Code Changes Required
[File and component details]

## Acceptance Criteria
[Checklist]

## Technical Notes
[Implementation details]

---

Based on project codebase:
- Related component: [path]
- Similar patterns: [path1], [path2]
- Database table: [table]
```

### 5. **Auto-Suggestions Based on CSS Selector**

When a task is created, analyze the CSS selector and suggest:
- Which component file likely needs changes (based on className patterns)
- Which tRPC router might need APIs (based on data being manipulated)

Example:
```
Detected from selector: "button" in settings page
Suggested files to modify:
  - src/app/(dashboard)/settings/page.tsx
  - src/server/trpc/routers/settings.ts (if state change needed)
```

### 6. **Link Tasks to GitHub Issues/PRs**

Add optional field to task:
```yaml
githubIssue: "home-finder#123"
githubPR: "home-finder#456"
relatedTasks: ["task-id-1", "task-id-2"]
```

---

## Implementation Priority

### Phase 1 (This Week): **Fix Blocked Tasks**
- [ ] Complete Task 5 description ("Improve UI")
- [ ] Complete Task 6 description ("Location scoring recalculation")

### Phase 2 (Sprint): **Implement Core Features**
- [ ] Task 8: Main profile position (30 min, unblock others)
- [ ] Task 3: Full width profiles (30 min, UI foundation)
- [ ] Task 7: Full width all screens (1 hour, complete UI polish)
- [ ] Task 1: Add new metrics (2-3 hours, blocks image analysis features)
- [ ] Task 4: Image analyzer threshold (2-3 hours, depends on Task 1)
- [ ] Task 2: Prune DB (4-5 hours, optional admin feature)
- [ ] Task 6: Location recalculation (3-4 hours, depends on clarity)

### Phase 3 (Future): **Process Improvements**
- [ ] Update prototype-studio to support enhanced task metadata
- [ ] Create `npx proto tasks --export-for-llm` command
- [ ] Build task export backend that includes code context
- [ ] Add auto-suggestions based on CSS selectors

---

## Files to Potentially Modify (By Task)

### Task 1: Add Metrics
- `src/app/(dashboard)/settings/_components/metrics-tab.tsx` (new form)
- `src/server/trpc/routers/metrics.ts` (new procedure)
- `src/server/db/schema.ts` (verify table structure)
- `tests/e2e/metrics.spec.ts` (new e2e tests)

### Task 2: Prune DB
- `src/app/(dashboard)/settings/page.tsx` (new UI section)
- `src/server/trpc/routers/settings.ts` (new procedure)
- `tests/e2e/settings.spec.ts` (safety test for cascading deletes)

### Task 3, 7, 8: UI/Layout
- `src/app/(dashboard)/profiles/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- All pages in `src/app/(dashboard)/*/page.tsx`

### Task 4: Threshold Slider
- `src/app/(dashboard)/settings/_components/metrics-tab.tsx`
- `src/server/trpc/routers/settings.ts`
- `src/server/services/image-analyzer.ts` (usage)

### Task 6: Location Recalculation
- `src/app/(dashboard)/location-scoring/page.tsx` or settings
- `src/server/trpc/routers/location-scoring.ts`
- `src/server/services/scoring.ts`

---

## Conclusion

The HomeFinder AI task system successfully bridges UI-level feedback to development, but lacks the technical context LLMs need for implementation. By:

1. **Completing** incomplete task descriptions (Tasks 5 & 6)
2. **Enriching** descriptions with code file paths and component names
3. **Adding** acceptance criteria and effort estimates
4. **Creating** an LLM-optimized export format

Teams can dramatically improve implementation speed and reduce back-and-forth clarifications with AI assistants.

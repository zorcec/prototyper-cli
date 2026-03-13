import { parseAnnotations } from "./annotations.js";
import { extractProtoIds, hasExternalDependencies, isValidHtml } from "./html-parser.js";
import type { ValidationIssue, ValidationResult } from "./types.js";

// CDN patterns that are explicitly allowed in prototypes (UI libs, fonts, icons)
const ALLOWED_CDN_PATTERNS = [
  "cdn.tailwindcss.com",
  "tailwindcss.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.lucide.dev",
  "esm.sh",
  "skypack.dev",
];

function isAllowedCdn(url: string): boolean {
  return ALLOWED_CDN_PATTERNS.some((pattern) => url.includes(pattern));
}

export function validateHtml(
  html: string,
  previousIds?: string[],
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isValidHtml(html)) {
    issues.push({ type: "error", message: "File is not valid HTML" });
    return {
      valid: false,
      issues,
      stats: {
        elementsWithIds: 0,
        totalAnnotations: 0,
        unresolvedTodos: 0,
        unresolvedFeatures: 0,
        preservedKeeps: 0,
      },
    };
  }

  const currentIds = extractProtoIds(html);
  const annotations = parseAnnotations(html);

  if (previousIds) {
    for (const id of previousIds) {
      if (!currentIds.includes(id)) {
        issues.push({
          type: "error",
          message: `Missing data-proto-id="${id}" — element was removed or id changed`,
          element: id,
        });
      }
    }
  }

  const unresolvedTodos = annotations.filter((a) => a.tag === "TODO");
  const unresolvedFeatures = annotations.filter((a) => a.tag === "FEATURE");
  const keeps = annotations.filter((a) => a.tag === "KEEP");

  for (const todo of unresolvedTodos) {
    issues.push({
      type: "warning",
      message: `Unresolved @TODO: "${todo.text}" at ${todo.targetSelector}`,
      element: todo.targetSelector,
    });
  }

  for (const feat of unresolvedFeatures) {
    issues.push({
      type: "warning",
      message: `Unresolved @FEATURE: "${feat.text}" at ${feat.targetSelector}`,
      element: feat.targetSelector,
    });
  }

  const externals = hasExternalDependencies(html);
  for (const ext of externals) {
    const url = ext.split(": ")[1] ?? "";
    if (!isAllowedCdn(url)) {
      issues.push({
        type: "warning",
        message: `Non-CDN external dependency: ${ext} — use Tailwind/jsDelivr/unpkg instead`,
      });
    }
  }

  if (currentIds.length === 0) {
    issues.push({
      type: "warning",
      message:
        "No data-proto-id attributes found — annotations will not target reliably",
    });
  }

  const duplicateIds = currentIds.filter(
    (id, i) => currentIds.indexOf(id) !== i,
  );
  for (const dup of [...new Set(duplicateIds)]) {
    issues.push({
      type: "error",
      message: `Duplicate data-proto-id="${dup}"`,
      element: dup,
    });
  }

  const hasErrors = issues.some((i) => i.type === "error");

  return {
    valid: !hasErrors,
    issues,
    stats: {
      elementsWithIds: currentIds.length,
      totalAnnotations: annotations.length,
      unresolvedTodos: unresolvedTodos.length,
      unresolvedFeatures: unresolvedFeatures.length,
      preservedKeeps: keeps.length,
    },
  };
}

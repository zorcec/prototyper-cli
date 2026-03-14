// ── Annotation tags ────────────────────────────────────────────────────────
export const ANNOTATION_TAGS = [
  "TODO",
  "FEATURE",
  "VARIANT",
  "KEEP",
  "QUESTION",
  "CONTEXT",
] as const;

export type AnnotationTag = (typeof ANNOTATION_TAGS)[number];

// ── Task system (.proto/tasks/*.md) ────────────────────────────────────────
export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tag: AnnotationTag;
  url?: string;
  selector: string;
  screenshot?: string;
  created: string;
  updated?: string;
}

export interface ProtoConfig {
  mode: "prototype" | "attach";
  url?: string;
  port: number;
}

export const PROTO_DIR = ".proto";
export const TASKS_DIR = "tasks";
export const SCREENSHOTS_DIR = "screenshots";
export const CONFIG_FILE = "config.json";

// ── Legacy annotation types (kept for migration) ──────────────────────────
export interface Annotation {
  id: string;
  tag: AnnotationTag;
  targetSelector: string;
  text: string;
  createdAt: string;
}

export interface AnnotationComment {
  tag: AnnotationTag;
  targetSelector: string;
  text: string;
}

// ── Serve options ──────────────────────────────────────────────────────────
export interface ServeOptions {
  port: number;
  open: boolean;
  /** When true, the server serves raw HTML without injecting the overlay script. */
  noOverlay?: boolean;
}

// ── Export / validation results ────────────────────────────────────────────
export interface TaskExportResult {
  prompt: string;
  taskCount: number;
  tasks: Task[];
}

export interface ExportResult {
  prompt: string;
  annotationCount: number;
  filePath: string;
}

export interface ValidationIssue {
  type: "error" | "warning";
  message: string;
  element?: string;
}

export interface TaskValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    totalTasks: number;
    todoCount: number;
    inProgressCount: number;
    doneCount: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    elementsWithIds: number;
    totalAnnotations: number;
    unresolvedTodos: number;
    unresolvedFeatures: number;
    preservedKeeps: number;
  };
}

export interface DirectoryExportResult {
  prompt: string;
  files: Array<{ filePath: string; annotationCount: number }>;
  totalAnnotations: number;
}

export interface DirectoryValidationResult {
  valid: boolean;
  fileResults: Record<string, ValidationResult>;
  crossFileIssues: ValidationIssue[];
  stats: {
    filesChecked: number;
    filesWithErrors: number;
    filesWithWarnings: number;
    totalAnnotations: number;
  };
}

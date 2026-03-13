export const ANNOTATION_TAGS = [
  "TODO",
  "FEATURE",
  "VARIANT",
  "KEEP",
  "QUESTION",
  "CONTEXT",
] as const;

export type AnnotationTag = (typeof ANNOTATION_TAGS)[number];

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

export interface ServeOptions {
  port: number;
  open: boolean;
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

import { randomUUID } from "node:crypto";
import type { Annotation, AnnotationComment, AnnotationTag } from "./types.js";
import { ANNOTATION_TAGS } from "./types.js";

const COMMENT_PATTERN =
  /<!--\s*@(TODO|FEATURE|VARIANT|KEEP|QUESTION|CONTEXT)\[([^\]]+)\]\s*([\s\S]*?)\s*-->/g;

const SELECTOR_PATTERN = /data-proto-id="([^"]+)"/;

export function parseAnnotations(html: string): Annotation[] {
  const annotations: Annotation[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(COMMENT_PATTERN.source, COMMENT_PATTERN.flags);

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1] as AnnotationTag;
    const selectorRaw = match[2];
    const text = match[3].trim();

    if (!ANNOTATION_TAGS.includes(tag)) continue;

    const selectorMatch = SELECTOR_PATTERN.exec(selectorRaw);
    const targetSelector = selectorMatch
      ? `[data-proto-id="${selectorMatch[1]}"]`
      : selectorRaw;

    annotations.push({
      id: randomUUID(),
      tag,
      targetSelector,
      text,
      createdAt: new Date().toISOString(),
    });
  }

  return annotations;
}

export function formatAnnotationComment(annotation: AnnotationComment): string {
  return `<!-- @${annotation.tag}[${annotation.targetSelector}] ${annotation.text} -->`;
}

export function insertAnnotation(
  html: string,
  targetSelector: string,
  annotation: AnnotationComment,
): string {
  const idMatch = /data-proto-id="([^"]+)"/.exec(targetSelector);
  if (!idMatch) return html;

  const protoId = idMatch[1];
  const elementPattern = new RegExp(
    `(<[^>]*data-proto-id="${escapeRegex(protoId)}"[^>]*>)`,
  );
  const match = elementPattern.exec(html);
  if (!match) return html;

  const comment = formatAnnotationComment(annotation);
  const insertPos = match.index;
  return html.slice(0, insertPos) + comment + "\n" + html.slice(insertPos);
}

export function removeAnnotation(
  html: string,
  tag: AnnotationTag,
  targetSelector: string,
): string {
  const idMatch = /data-proto-id="([^"]+)"/.exec(targetSelector);
  if (!idMatch) return html;

  const protoId = idMatch[1];
  const pattern = new RegExp(
    `<!--\\s*@${tag}\\[data-proto-id="${escapeRegex(protoId)}"\\]\\s*[\\s\\S]*?\\s*-->\\n?`,
  );
  return html.replace(pattern, "");
}

export function countAnnotationsByTag(
  annotations: Annotation[],
): Record<AnnotationTag, number> {
  const counts = Object.fromEntries(
    ANNOTATION_TAGS.map((tag) => [tag, 0]),
  ) as Record<AnnotationTag, number>;

  for (const a of annotations) {
    counts[a.tag]++;
  }
  return counts;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

import { describe, it, expect } from "vitest";
import {
  parseAnnotations,
  formatAnnotationComment,
  insertAnnotation,
  removeAnnotation,
  countAnnotationsByTag,
} from "../../src/core/annotations.js";
import type { AnnotationComment } from "../../src/core/types.js";

describe("parseAnnotations", () => {
  it("parses a single TODO annotation", () => {
    const html = `<!-- @TODO[data-proto-id="btn-1"] Change button color -->
<button data-proto-id="btn-1">Click</button>`;

    const result = parseAnnotations(html);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("TODO");
    expect(result[0].targetSelector).toBe('[data-proto-id="btn-1"]');
    expect(result[0].text).toBe("Change button color");
    expect(result[0].id).toBeDefined();
    expect(result[0].createdAt).toBeDefined();
  });

  it("parses multiple different annotation tags", () => {
    const html = `<!-- @TODO[data-proto-id="a"] Fix this -->
<!-- @FEATURE[data-proto-id="b"] Add tooltip -->
<!-- @KEEP[data-proto-id="c"] Do not change -->
<!-- @QUESTION[data-proto-id="d"] Is this correct? -->
<!-- @CONTEXT[data-proto-id="e"] Background info -->
<!-- @VARIANT[data-proto-id="f"] Try dark theme -->`;

    const result = parseAnnotations(html);
    expect(result).toHaveLength(6);
    expect(result.map((a) => a.tag)).toEqual([
      "TODO",
      "FEATURE",
      "KEEP",
      "QUESTION",
      "CONTEXT",
      "VARIANT",
    ]);
  });

  it("returns empty array for HTML without annotations", () => {
    const html = `<div data-proto-id="test">Hello</div>`;
    expect(parseAnnotations(html)).toEqual([]);
  });

  it("handles multiline annotation text", () => {
    const html = `<!-- @TODO[data-proto-id="nav-1"]
Make the navigation responsive
and add a hamburger menu on mobile -->
<nav data-proto-id="nav-1">...</nav>`;

    const result = parseAnnotations(html);
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("responsive");
    expect(result[0].text).toContain("hamburger");
  });

  it("handles annotation with extra whitespace", () => {
    const html = `<!--   @TODO[data-proto-id="x"]   Some feedback   -->`;
    const result = parseAnnotations(html);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Some feedback");
  });

  it("ignores invalid tags", () => {
    const html = `<!-- @INVALID[data-proto-id="x"] Not a real tag -->`;
    expect(parseAnnotations(html)).toEqual([]);
  });

  it("ignores regular HTML comments", () => {
    const html = `<!-- This is a regular comment -->
<div data-proto-id="test">Hello</div>`;
    expect(parseAnnotations(html)).toEqual([]);
  });
});

describe("formatAnnotationComment", () => {
  it("formats a TODO annotation", () => {
    const annotation: AnnotationComment = {
      tag: "TODO",
      targetSelector: 'data-proto-id="btn-1"',
      text: "Change color to blue",
    };
    expect(formatAnnotationComment(annotation)).toBe(
      '<!-- @TODO[data-proto-id="btn-1"] Change color to blue -->',
    );
  });

  it("formats a KEEP annotation", () => {
    const annotation: AnnotationComment = {
      tag: "KEEP",
      targetSelector: 'data-proto-id="logo"',
      text: "Do not modify",
    };
    expect(formatAnnotationComment(annotation)).toBe(
      '<!-- @KEEP[data-proto-id="logo"] Do not modify -->',
    );
  });

  it("formats all tag types", () => {
    const tags = ["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"] as const;
    for (const tag of tags) {
      const result = formatAnnotationComment({
        tag,
        targetSelector: 'data-proto-id="el"',
        text: "test",
      });
      expect(result).toContain(`@${tag}`);
    }
  });
});

describe("insertAnnotation", () => {
  const baseHtml = `<div>
  <button data-proto-id="btn-submit">Submit</button>
  <p data-proto-id="para-1">Hello</p>
</div>`;

  it("inserts annotation before the target element", () => {
    const annotation: AnnotationComment = {
      tag: "TODO",
      targetSelector: 'data-proto-id="btn-submit"',
      text: "Make it bigger",
    };
    const result = insertAnnotation(
      baseHtml,
      'data-proto-id="btn-submit"',
      annotation,
    );
    expect(result).toContain('<!-- @TODO[data-proto-id="btn-submit"] Make it bigger -->');
    const commentIdx = result.indexOf("@TODO");
    const elementIdx = result.indexOf("btn-submit");
    expect(commentIdx).toBeLessThan(elementIdx);
  });

  it("returns unchanged HTML when target not found", () => {
    const annotation: AnnotationComment = {
      tag: "TODO",
      targetSelector: 'data-proto-id="nonexistent"',
      text: "Fix this",
    };
    const result = insertAnnotation(
      baseHtml,
      'data-proto-id="nonexistent"',
      annotation,
    );
    expect(result).toBe(baseHtml);
  });

  it("returns unchanged HTML when selector has no data-proto-id pattern", () => {
    const annotation: AnnotationComment = {
      tag: "TODO",
      targetSelector: ".some-class",
      text: "Fix this",
    };
    const result = insertAnnotation(baseHtml, ".some-class", annotation);
    expect(result).toBe(baseHtml);
  });
});

describe("removeAnnotation", () => {
  it("removes a TODO annotation for a specific element", () => {
    const html = `<!-- @TODO[data-proto-id="btn-1"] Fix this -->
<button data-proto-id="btn-1">Click</button>`;

    const result = removeAnnotation(html, "TODO", 'data-proto-id="btn-1"');
    expect(result).not.toContain("@TODO");
    expect(result).toContain('data-proto-id="btn-1"');
  });

  it("does not remove annotations for other elements", () => {
    const html = `<!-- @TODO[data-proto-id="btn-1"] Fix this -->
<!-- @TODO[data-proto-id="btn-2"] And this -->
<button data-proto-id="btn-1">Click</button>
<button data-proto-id="btn-2">Click 2</button>`;

    const result = removeAnnotation(html, "TODO", 'data-proto-id="btn-1"');
    expect(result).not.toContain("btn-1] Fix this");
    expect(result).toContain('@TODO[data-proto-id="btn-2"]');
  });

  it("returns unchanged HTML when no matching annotation", () => {
    const html = `<button data-proto-id="btn-1">Click</button>`;
    const result = removeAnnotation(html, "TODO", 'data-proto-id="btn-1"');
    expect(result).toBe(html);
  });

  it("returns unchanged HTML for invalid selector", () => {
    const html = `<!-- @TODO[data-proto-id="btn-1"] Fix -->`;
    const result = removeAnnotation(html, "TODO", ".no-id");
    expect(result).toBe(html);
  });
});

describe("countAnnotationsByTag", () => {
  it("counts annotations grouped by tag", () => {
    const html = `<!-- @TODO[data-proto-id="a"] Fix -->
<!-- @TODO[data-proto-id="b"] Fix 2 -->
<!-- @FEATURE[data-proto-id="c"] Add -->
<!-- @KEEP[data-proto-id="d"] Preserve -->`;

    const annotations = parseAnnotations(html);
    const counts = countAnnotationsByTag(annotations);
    expect(counts.TODO).toBe(2);
    expect(counts.FEATURE).toBe(1);
    expect(counts.KEEP).toBe(1);
    expect(counts.VARIANT).toBe(0);
    expect(counts.QUESTION).toBe(0);
    expect(counts.CONTEXT).toBe(0);
  });

  it("returns all zeros for empty annotations", () => {
    const counts = countAnnotationsByTag([]);
    expect(Object.values(counts).every((v) => v === 0)).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(process.cwd(), "dist", "index.js");
const run = (args: string) => {
  try {
    return {
      stdout: execSync(`node ${CLI} ${args}`, { encoding: "utf-8" }),
      exitCode: 0,
    };
  } catch (err: unknown) {
    const e = err as { stdout: string; status: number };
    return { stdout: e.stdout ?? "", exitCode: e.status ?? 1 };
  }
};

describe("proto validate (e2e)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-e2e-validate-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("passes for valid HTML with proto-ids", () => {
    const html = `<!DOCTYPE html><html><body>
<div data-proto-id="hero">Hero</div>
<button data-proto-id="cta">Click</button>
</body></html>`;

    const filePath = join(tempDir, "valid.html");
    writeFileSync(filePath, html, "utf-8");

    const { stdout, exitCode } = run(`validate ${filePath}`);
    expect(stdout).toContain("Validation passed");
    expect(exitCode).toBe(0);
  });

  it("fails when previous IDs are missing", () => {
    const prevHtml = `<div data-proto-id="hero">Hero</div>
<div data-proto-id="sidebar">Side</div>`;
    const currHtml = `<div data-proto-id="hero">Hero</div>`;

    const prevPath = join(tempDir, "prev.html");
    const currPath = join(tempDir, "curr.html");
    writeFileSync(prevPath, prevHtml, "utf-8");
    writeFileSync(currPath, currHtml, "utf-8");

    const { stdout, exitCode } = run(
      `validate ${currPath} --previous ${prevPath}`,
    );
    expect(stdout).toContain("Validation failed");
    expect(stdout).toContain("sidebar");
    expect(exitCode).toBe(1);
  });

  it("warns about unresolved annotations", () => {
    const html = `<!-- @TODO[data-proto-id="btn"] Fix this -->
<button data-proto-id="btn">Click</button>`;

    const filePath = join(tempDir, "todos.html");
    writeFileSync(filePath, html, "utf-8");

    const { stdout } = run(`validate ${filePath}`);
    expect(stdout).toContain("@TODO");
  });

  it("detects duplicate proto-ids", () => {
    const html = `<div data-proto-id="dup">A</div>
<div data-proto-id="dup">B</div>`;

    const filePath = join(tempDir, "dups.html");
    writeFileSync(filePath, html, "utf-8");

    const { stdout, exitCode } = run(`validate ${filePath}`);
    expect(stdout).toContain("Duplicate");
    expect(exitCode).toBe(1);
  });

  it("passes when all previous IDs are preserved", () => {
    const prevHtml = `<div data-proto-id="a">A</div>`;
    const currHtml = `<div data-proto-id="a">A Updated</div>
<div data-proto-id="b">B New</div>`;

    const prevPath = join(tempDir, "prev.html");
    const currPath = join(tempDir, "curr.html");
    writeFileSync(prevPath, prevHtml, "utf-8");
    writeFileSync(currPath, currHtml, "utf-8");

    const { stdout, exitCode } = run(
      `validate ${currPath} --previous ${prevPath}`,
    );
    expect(stdout).toContain("Validation passed");
    expect(exitCode).toBe(0);
  });
});

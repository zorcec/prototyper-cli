import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(process.cwd(), "dist", "index.js");
const run = (args: string, cwd?: string) =>
  execSync(`node ${CLI} ${args}`, {
    encoding: "utf-8",
    cwd: cwd ?? process.cwd(),
  });

describe("proto init (e2e)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-e2e-init-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates rules file in target directory", () => {
    const output = run(`init ${tempDir}`);
    expect(output).toContain("Prototype Studio initialized");
    expect(existsSync(join(tempDir, "prototype-rules.md"))).toBe(true);
  });

  it("creates copilot instructions file", () => {
    run(`init ${tempDir}`);
    const copilotFile = join(
      tempDir,
      ".github",
      "instructions",
      "prototype-studio.instructions.md",
    );
    expect(existsSync(copilotFile)).toBe(true);
    const content = readFileSync(copilotFile, "utf-8");
    expect(content).toContain("data-proto-id");
  });

  it("rules file contains all annotation tags", () => {
    run(`init ${tempDir}`);
    const content = readFileSync(
      join(tempDir, "prototype-rules.md"),
      "utf-8",
    );
    for (const tag of ["TODO", "FEATURE", "VARIANT", "KEEP", "QUESTION", "CONTEXT"]) {
      expect(content).toContain(`@${tag}`);
    }
  });

  it("rules file references CDN libraries", () => {
    run(`init ${tempDir}`);
    const content = readFileSync(join(tempDir, "prototype-rules.md"), "utf-8");
    expect(content).toContain("cdn.tailwindcss.com");
    expect(content).toContain("unpkg.com/lucide");
    expect(content).toContain("fonts.googleapis.com");
  });

  it("rules file describes multi-page conventions", () => {
    run(`init ${tempDir}`);
    const content = readFileSync(join(tempDir, "prototype-rules.md"), "utf-8");
    expect(content).toContain("One Screen Per File");
    expect(content).toContain("Multi-Page Conventions");
    expect(content).toContain("Globally unique");
  });

  it("creates package.json with proto scripts", () => {
    run(`init ${tempDir}`);
    const pkgPath = join(tempDir, "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.scripts.serve).toContain("proto serve");
    expect(pkg.scripts.export).toContain("proto export");
    expect(pkg.scripts.validate).toContain("proto validate");
    expect(pkg.name).toBe("prototypes");
  });

  it("creates .gitignore with node_modules", () => {
    run(`init ${tempDir}`);
    const gitignorePath = join(tempDir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, "utf-8");
    expect(content).toContain("node_modules");
  });

  it("creates starter index.html with Tailwind and proto-ids", () => {
    run(`init ${tempDir}`);
    const indexPath = join(tempDir, "index.html");
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("cdn.tailwindcss.com");
    expect(content).toContain("data-proto-id");
    expect(content).toContain("lucide");
  });

  it("does not overwrite existing package.json on second run", () => {
    run(`init ${tempDir}`);
    const pkgPath = join(tempDir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ name: "my-custom-pkg" }), "utf-8");
    run(`init ${tempDir}`);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("my-custom-pkg");
  });

  it("does not overwrite existing index.html on second run", () => {
    run(`init ${tempDir}`);
    const indexPath = join(tempDir, "index.html");
    writeFileSync(indexPath, "<html>custom</html>", "utf-8");
    run(`init ${tempDir}`);
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toBe("<html>custom</html>");
  });

  it("output shows success and ready message", () => {
    const output = run(`init ${tempDir}`);
    expect(output).toContain("Prototype Studio initialized");
    expect(output).toContain("Ready! Start prototyping");
  });

  it("can be run twice without errors", () => {
    run(`init ${tempDir}`);
    expect(() => run(`init ${tempDir}`)).not.toThrow();
  });
});

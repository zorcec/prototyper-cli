import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attachProject } from "../../src/commands/attach.js";

describe("attachProject", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "proto-attach-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates .proto config.json in attach mode with given URL", () => {
    attachProject(tempDir, "http://localhost:4000");
    const configPath = join(tempDir, ".proto", "config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.mode).toBe("attach");
    expect(config.url).toBe("http://localhost:4000");
    expect(config.port).toBe(3700);
  });

  it("uses default URL when none provided", () => {
    attachProject(tempDir);
    const config = JSON.parse(readFileSync(join(tempDir, ".proto", "config.json"), "utf-8"));
    expect(config.url).toBe("http://localhost:3000");
  });

  it("creates .proto/tasks and .proto/screenshots directories", () => {
    attachProject(tempDir);
    expect(existsSync(join(tempDir, ".proto", "tasks"))).toBe(true);
    expect(existsSync(join(tempDir, ".proto", "screenshots"))).toBe(true);
  });

  it("creates .gitignore with screenshots entry when no gitignore exists", () => {
    attachProject(tempDir);
    const gitignorePath = join(tempDir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, "utf-8");
    expect(content).toContain(".proto/screenshots/");
  });

  it("appends screenshots entry to existing .gitignore", () => {
    writeFileSync(join(tempDir, ".gitignore"), "node_modules/\n", "utf-8");
    attachProject(tempDir);
    const content = readFileSync(join(tempDir, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".proto/screenshots/");
  });

  it("does not duplicate screenshots entry in existing .gitignore", () => {
    writeFileSync(join(tempDir, ".gitignore"), "node_modules/\n.proto/screenshots/\n", "utf-8");
    attachProject(tempDir);
    const content = readFileSync(join(tempDir, ".gitignore"), "utf-8");
    const matchCount = (content.match(/\.proto\/screenshots\//g) || []).length;
    expect(matchCount).toBe(1);
  });

  it("adds proto scripts to existing package.json", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "my-app", scripts: {} }, null, 2),
      "utf-8",
    );
    attachProject(tempDir);
    const pkg = JSON.parse(readFileSync(join(tempDir, "package.json"), "utf-8"));
    expect(pkg.scripts["proto:serve"]).toBe("proto serve .");
    expect(pkg.scripts["proto:export"]).toBe("proto export .");
    expect(pkg.scripts["proto:validate"]).toBe("proto validate .");
  });

  it("does not overwrite existing proto scripts in package.json", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "my-app",
        scripts: { "proto:serve": "my-custom-serve" },
      }, null, 2),
      "utf-8",
    );
    attachProject(tempDir);
    const pkg = JSON.parse(readFileSync(join(tempDir, "package.json"), "utf-8"));
    expect(pkg.scripts["proto:serve"]).toBe("my-custom-serve");
  });

  it("returns list of created files", () => {
    const result = attachProject(tempDir);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files).toContain(join(tempDir, ".proto", "config.json"));
  });

  it("can be run twice without error", () => {
    attachProject(tempDir);
    expect(() => attachProject(tempDir)).not.toThrow();
  });
});

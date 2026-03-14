import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ProtoConfig } from "./types.js";
import { PROTO_DIR, CONFIG_FILE } from "./types.js";

const DEFAULT_CONFIG: ProtoConfig = {
  mode: "prototype",
  port: 3700,
};

export function getConfigPath(projectDir: string): string {
  return join(projectDir, PROTO_DIR, CONFIG_FILE);
}

export function hasProtoDir(projectDir: string): boolean {
  return existsSync(join(projectDir, PROTO_DIR));
}

export function ensureProtoDir(projectDir: string): void {
  mkdirSync(join(projectDir, PROTO_DIR), { recursive: true });
}

export function readConfig(projectDir: string): ProtoConfig {
  const configPath = getConfigPath(projectDir);
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };

  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<ProtoConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
  };
}

export function writeConfig(
  projectDir: string,
  config: ProtoConfig,
): void {
  ensureProtoDir(projectDir);
  const configPath = getConfigPath(projectDir);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

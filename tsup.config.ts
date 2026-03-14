import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig([
  // CLI bundle (clean first)
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    dts: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  // Chrome extension bundles (after CLI, no clean)
  {
    entry: {
      "chrome-extension/content-script": "src/extension/content-script.ts",
      "chrome-extension/background": "src/extension/background.ts",
      "chrome-extension/popup": "src/extension/popup.ts",
    },
    format: ["iife"],
    target: "chrome120",
    outDir: "dist",
    clean: false,
    sourcemap: false,
    noExternal: [/.*/],
    esbuildOptions(options) {
      options.outExtension = { ".js": ".js" };
    },
    onSuccess: async () => {
      cpSync("src/extension/manifest.json", "dist/chrome-extension/manifest.json");
      cpSync("src/extension/popup.html", "dist/chrome-extension/popup.html");
      cpSync("src/extension/icons", "dist/chrome-extension/icons", { recursive: true });
    },
  },
]);

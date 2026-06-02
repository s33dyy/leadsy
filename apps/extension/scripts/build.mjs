import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist");

await build({
  configFile: false,
  root,
  publicDir: resolve(root, "public"),
  build: {
    emptyOutDir: true,
    outDir,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(root, "src/background/index.ts"),
        sidePanel: resolve(root, "src/sidepanel/index.ts")
      },
      output: {
        assetFileNames: "assets/[name].[ext]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "assets/[name].js",
        format: "es"
      }
    }
  }
});

await build({
  configFile: false,
  root,
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir,
    sourcemap: true,
    rollupOptions: {
      input: resolve(root, "src/content/index.ts"),
      output: {
        assetFileNames: "assets/[name].[ext]",
        entryFileNames: "assets/contentScript.js",
        format: "iife",
        inlineDynamicImports: true,
        name: "LeadsyWorkerContent"
      }
    }
  }
});

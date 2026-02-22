#!/usr/bin/env ts-node
/**
 * render.ts — CLI wrapper around Remotion renderMedia.
 *
 * Usage:
 *   npx ts-node render.ts \
 *     --frames-dir ./path/to/frames \
 *     --captions '[{"text":"Hello","startFrame":30,"durationFrames":90}]' \
 *     --output output.mp4 \
 *     --preset x-landscape \
 *     --product-name "My Product" \
 *     --install-command "$ npm install my-product"
 */

import * as fs from "fs";
import * as path from "path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { TerminalDemoProps, Caption } from "./src/TerminalDemo";

// ─── CLI arg parser ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx !== -1 && idx < argv.length - 1 ? argv[idx + 1] : undefined;
}

function requireArg(flag: string): string {
  const val = getArg(flag);
  if (!val) {
    console.error(`\n  ✖  Missing required argument: ${flag}\n`);
    printUsage();
    process.exit(1);
  }
  return val;
}

function printUsage() {
  console.log(`
Usage:
  npx ts-node render.ts [options]

Required:
  --frames-dir <path>      Directory containing frame images (PNG/JPG)

Optional:
  --captions <json|path>   JSON array of captions, or path to .json file
  --output <path>          Output mp4 path (default: output.mp4)
  --preset <name>          x-landscape | x-portrait | phone  (default: x-landscape)
  --product-name <name>    Product name for end card
  --install-command <cmd>  Install command for end card (default: $ npm install)

Example:
  npx ts-node render.ts \\
    --frames-dir ./recordings/session-01 \\
    --captions '[{"text":"Zero config","startFrame":30,"durationFrames":90}]' \\
    --output demo.mp4 \\
    --preset x-landscape \\
    --product-name "my-cli" \\
    --install-command "$ npm install -g my-cli"
`);
}

// ─── Parse args ───────────────────────────────────────────────────────────────

const framesDir = requireArg("--frames-dir");
const outputPath = getArg("--output") ?? "output.mp4";
const preset = (getArg("--preset") ?? "x-landscape") as
  | "x-landscape"
  | "x-portrait"
  | "phone";
const productName = getArg("--product-name");
const installCommand =
  getArg("--install-command") ??
  (productName ? `$ npm install ${productName}` : undefined);

// Resolve frames directory
const resolvedFramesDir = path.resolve(framesDir);
if (!fs.existsSync(resolvedFramesDir)) {
  console.error(`\n  ✖  Frames directory not found: ${resolvedFramesDir}\n`);
  process.exit(1);
}

// Read frame files
const VALID_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
let frameFiles: string[];
try {
  frameFiles = fs
    .readdirSync(resolvedFramesDir)
    .filter((f) => VALID_EXTS.includes(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(resolvedFramesDir, f));
} catch (e) {
  console.error(`\n  ✖  Failed to read frames directory: ${(e as Error).message}\n`);
  process.exit(1);
}

if (frameFiles.length === 0) {
  console.error(
    `\n  ✖  No image files found in: ${resolvedFramesDir}\n` +
      `     Supported formats: ${VALID_EXTS.join(", ")}\n`
  );
  process.exit(1);
}

// Parse captions
const captionsArg = getArg("--captions");
let captions: Caption[] = [];
if (captionsArg) {
  // Could be a file path or raw JSON
  if (
    (captionsArg.endsWith(".json") || captionsArg.startsWith("/") || captionsArg.startsWith(".")) &&
    fs.existsSync(captionsArg)
  ) {
    try {
      captions = JSON.parse(fs.readFileSync(captionsArg, "utf-8"));
    } catch (e) {
      console.error(`\n  ✖  Failed to parse captions file: ${(e as Error).message}\n`);
      process.exit(1);
    }
  } else {
    try {
      captions = JSON.parse(captionsArg);
    } catch (e) {
      console.error(`\n  ✖  Failed to parse --captions JSON: ${(e as Error).message}\n`);
      process.exit(1);
    }
  }
  if (!Array.isArray(captions)) {
    console.error("\n  ✖  --captions must be a JSON array\n");
    process.exit(1);
  }
}

// ─── Stage frames into public/frames/ ────────────────────────────────────────

const projectRoot = __dirname;
const publicFramesDir = path.join(projectRoot, "public", "frames");

console.log("\n  📁  Staging frames...");
fs.mkdirSync(publicFramesDir, { recursive: true });

// Clean previous frames
const existingFrames = fs
  .readdirSync(publicFramesDir)
  .filter((f) => VALID_EXTS.includes(path.extname(f).toLowerCase()));
for (const f of existingFrames) {
  fs.unlinkSync(path.join(publicFramesDir, f));
}

const frameNames: string[] = frameFiles.map((src, i) => {
  const ext = path.extname(src);
  const name = `frame-${String(i).padStart(5, "0")}${ext}`;
  fs.copyFileSync(src, path.join(publicFramesDir, name));
  return `frames/${name}`;
});

console.log(`  ✓  Staged ${frameNames.length} frame(s)`);
console.log(`  ✓  Loaded ${captions.length} caption(s)`);

// ─── Render ───────────────────────────────────────────────────────────────────

const inputProps: TerminalDemoProps = {
  frames: frameNames,
  captions,
  preset,
  ...(productName ? { productName } : {}),
  ...(installCommand ? { installCommand } : {}),
};

async function main() {
  // Bundle
  console.log("\n  📦  Bundling project...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(projectRoot, "src", "index.ts"),
    webpackOverride: (config) => config,
  });

  // Select composition (also runs calculateMetadata so we know dimensions/duration)
  console.log("  🎬  Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "TerminalDemo",
    inputProps,
  });

  const durationSecs = (composition.durationInFrames / composition.fps).toFixed(1);
  console.log(
    `  🎥  Rendering ${composition.width}×${composition.height} @ ${composition.fps}fps, ${durationSecs}s (${composition.durationInFrames} frames)`
  );
  console.log(`  📄  Output: ${path.resolve(outputPath)}\n`);

  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: path.resolve(outputPath),
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        const filled = Math.round(pct / 2);
        const bar = "█".repeat(filled) + "░".repeat(50 - filled);
        process.stdout.write(`\r  [${bar}] ${pct}%`);
      }
    },
  });

  console.log(`\n\n  ✅  Done → ${path.resolve(outputPath)}\n`);
}

main().catch((err) => {
  console.error("\n  ✖  Render failed:\n", err);
  process.exit(1);
});

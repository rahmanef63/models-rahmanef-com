#!/usr/bin/env node
// Guard: keep the feature-slice boundary clean, forever.
//
// After the `core` extraction (frontend/slices/core), the shared UI kit no longer lives under the
// app root. This check fails the build if anyone:
//   1. resurrects one of the 4 retired barrel files under app/app/_components,
//   2. imports a retired barrel path (`.../shared|responsive-dialog|use-theme|error-boundary`), or
//   3. reaches from a feature slice into the app root (`@/app/app/_components/*`).
//
// Runs in CI via the root `npm test` chain, so re-coupling can't slip in unnoticed.
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("..", import.meta.url)); // web/
const fails = [];

// 1) the retired barrels must stay retired
const RETIRED = [
  "app/app/_components/shared.tsx",
  "app/app/_components/responsive-dialog.tsx",
  "app/app/_components/use-theme.ts",
  "app/app/_components/error-boundary.tsx",
];
for (const f of RETIRED) if (existsSync(join(WEB, f))) fails.push(`retired barrel resurrected: ${f}`);

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "_generated") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.tsx?$/.test(e.name)) yield p;
  }
}

// import path ending in one of the retired basenames (matches `./shared`, `_components/shared`, …)
const BARREL_IMPORT = /from\s+["'][^"']*(?:\/|\.\/)(?:shared|responsive-dialog|use-theme|error-boundary)["']/;
const APP_ROOT = /from\s+["']@\/app\/app\/_components/;

for (const root of ["app", "frontend"]) {
  const base = join(WEB, root);
  if (!existsSync(base)) continue;
  for (const file of walk(base)) {
    const rel = relative(WEB, file).replaceAll("\\", "/");
    // core owns the real files at these basenames — its own internal barrel imports are the source of truth
    if (rel.startsWith("frontend/slices/core/")) continue;
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (BARREL_IMPORT.test(line)) fails.push(`${rel}:${i + 1} imports a retired barrel → ${line.trim()}`);
      if (root === "frontend" && APP_ROOT.test(line)) fails.push(`${rel}:${i + 1} slice reaches into the app root → ${line.trim()}`);
    });
  }
}

if (fails.length) {
  console.error("✗ slice-boundary check FAILED:\n" + fails.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("✓ slice boundaries clean — no app-root coupling, no retired barrels");

#!/usr/bin/env bun
// Release gate: refuse a build that points at a dev server. build:dev and build:local
// bake in localhost, and build:local is indistinguishable from a release artifact.
// Shipping one fails silently: installs, opens, reaches nothing. No --confirm escape.
// usage: bun scripts/assert-no-dev-env.mjs [build-dir] [--require-prod-origin]

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const requireProdOrigin = args.includes("--require-prod-origin");
const BUILD_DIR =
  args.find((a) => !a.startsWith("--")) || join(__dirname, "..", "build");

const DEV_ORIGIN = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g;

// .map is deliberately NOT skipped: a production build still emits
// recorderkeepalive.bundle.js.map, and its sourcesContent carries original
// source that the minified bundle no longer shows. verify-no-secrets scans
// maps for the same reason.
const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff", ".woff2", ".ttf",
  ".otf", ".ico", ".mp3", ".mp4", ".webm", ".wasm", ".bin",
]);

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
};

if (!existsSync(BUILD_DIR)) {
  console.error(`FAIL: ${BUILD_DIR} missing. Build first.`);
  process.exit(1);
}

const findings = [];

for (const file of walk(BUILD_DIR)) {
  const ext = file.slice(file.lastIndexOf("."));
  if (SKIP_EXTENSIONS.has(ext)) continue;

  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const matches = [...new Set(contents.match(DEV_ORIGIN) || [])];
  if (matches.length) {
    findings.push({
      file: file.slice(BUILD_DIR.length + 1),
      matches: matches.slice(0, 5),
    });
  }
}

// dev builds and build:local keep localhost in externally_connectable, prod strips it.
// Second independent read: a bundle scan alone misses a build whose env was
// empty, not local.
const manifestPath = join(BUILD_DIR, "manifest.json");
let prodOrigins = [];
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const matches = manifest.externally_connectable?.matches || [];
    const devMatches = matches.filter(
      (m) => m.includes("localhost") || m.includes("127.0.0.1"),
    );
    if (devMatches.length) {
      findings.push({
        file: "manifest.json",
        matches: devMatches,
        note: "externally_connectable still lists dev origins",
      });
    }
    prodOrigins = matches
      .filter((m) => m.startsWith("https://"))
      .map((m) => m.replace(/\/\*$/, ""));
  } catch {
    console.error("FAIL: build/manifest.json is not valid JSON.");
    process.exit(1);
  }
}

if (findings.length) {
  console.error(`Dev-server references found in ${BUILD_DIR}:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}`);
    if (f.note) console.error(`    ${f.note}`);
    console.error(`    ${f.matches.join(", ")}`);
  }
  console.error(
    "\nThis build must NOT be released. Rebuild with `bun run build`" +
      " (or `build:release` for the self-hosted zip).",
  );
  process.exit(1);
}

// CWS only. Absence of dev origins isn't proof of wiring: an env file that
// failed to load leaves no localhost to find either. Self-hosted has no app
// base by design, hence opt-in.
if (requireProdOrigin) {
  if (!prodOrigins.length) {
    console.error(
      "FAIL: manifest lists no https origin to check the bundles against.",
    );
    process.exit(1);
  }
  const bundles = walk(BUILD_DIR).filter((f) => f.endsWith(".js"));
  const found = prodOrigins.filter((origin) =>
    bundles.some((f) => {
      try {
        return readFileSync(f, "utf8").includes(origin);
      } catch {
        return false;
      }
    }),
  );
  if (!found.length) {
    console.error(
      `FAIL: none of the production origins (${prodOrigins.join(", ")}) appear` +
        " in any bundle.\nThe env almost certainly failed to load; this build" +
        " points at nothing. Rebuild with `bun run build`.",
    );
    process.exit(1);
  }
  console.log(`Production origin baked in: ${found.join(", ")}`);
}

console.log(`No dev-server references in ${BUILD_DIR}.`);
process.exit(0);

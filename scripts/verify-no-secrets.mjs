#!/usr/bin/env node
// gate before publishing the self-hosted zip: scan build/ for API URLs,
// OAuth client IDs, sentry DSNs, raw .env values. build:release with
// SCREENITY_SKIP_ENV should already strip these; this is the catch-all.
// usage: node scripts/verify-no-secrets.mjs [build-dir]  (default: build/)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = process.argv[2] || join(__dirname, "..", "build");

// Allowed (do not flag): public homepage URLs, OAuth client_ids, public
// CDN endpoints (dead code when CLOUD_FEATURES_ENABLED=false).
// Forbidden: JWT/bearer tokens, API keys, .env values, Sentry DSNs.
const FORBIDDEN_PATTERNS = [
  /https?:\/\/[a-f0-9]{16,}@[a-z0-9.]+\.ingest\.sentry\.io/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bsk_live_[A-Za-z0-9]{16,}\b/,
  /['"]Bearer\s+[A-Za-z0-9_.\-]{20,}['"]/,
  /\bAIza[A-Za-z0-9_-]{35}\b/,
];

const SKIP_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".ico",
  ".mp3",
  ".mp4",
  ".webm",
  ".wasm",
  ".bin",
]);

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const s = statSync(path);
    if (s.isDirectory()) {
      out.push(...walk(path));
    } else {
      out.push(path);
    }
  }
  return out;
};

let hits = 0;
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

  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = contents.match(pattern);
    if (match) {
      const rel = file.slice(BUILD_DIR.length + 1);
      findings.push({ file: rel, pattern: pattern.source, match: match[0] });
      hits += 1;
    }
  }
}

if (hits === 0) {
  console.log(`No forbidden secrets found in ${BUILD_DIR}.`);
  process.exit(0);
}

console.log(`Found ${hits} secret leak(s) in ${BUILD_DIR}:\n`);
for (const f of findings) {
  console.log(`  ${f.file}`);
  console.log(`    pattern: ${f.pattern}`);
  console.log(`    match:   ${f.match.slice(0, 80)}`);
  console.log("");
}
console.log("This zip must NOT be published. Rebuild with build:release.");
process.exit(1);

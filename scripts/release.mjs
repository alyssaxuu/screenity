#!/usr/bin/env node
// release builder: bumps manifest + package version, runs i18n check,
// builds self-hosted (no env), verifies no secrets in the zip, prints
// the manual upload checklist. doesn't write release notes, push, or
// upload, those stay manual.
//
// usage: node scripts/release.mjs <patch|minor|major> [--dry-run]

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MANIFEST_PATH = join(ROOT, "src", "manifest.json");
const PACKAGE_PATH = join(ROOT, "package.json");
const BUILD_DIR = join(ROOT, "build");
const ZIP_PATH = join(ROOT, "build.zip");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const bumpKind = args.find((a) => ["patch", "minor", "major"].includes(a));

if (!bumpKind) {
  console.error("Usage: node scripts/release.mjs [--dry-run] patch|minor|major");
  process.exit(2);
}

const sh = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });

const shCapture = (cmd) =>
  execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();

const bumpSemver = (version, kind) => {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Cannot parse version: ${version}`);
  let [, major, minor, patch] = m.map(Number);
  if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
};

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

try {
  const status = shCapture("git status --porcelain");
  if (status) {
    console.warn(
      "Warning: working tree has uncommitted changes. Continuing anyway.\n",
    );
  }
} catch {}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
const currentManifestVersion = manifest.version;
const currentPkgVersion = pkg.version;

if (currentManifestVersion !== currentPkgVersion) {
  console.warn(
    `Warning: manifest (${currentManifestVersion}) and package.json (${currentPkgVersion}) versions differ.`,
  );
  console.warn(`Bumping from manifest version (${currentManifestVersion}).\n`);
}

const nextVersion = bumpSemver(currentManifestVersion, bumpKind);

console.log(`Version bump: ${currentManifestVersion} -> ${nextVersion}`);

if (DRY_RUN) {
  console.log("\n--dry-run: no files written, no build run.");
  process.exit(0);
}

manifest.version = nextVersion;
pkg.version = nextVersion;
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + "\n");
console.log("Wrote manifest.json + package.json.\n");

console.log("Running i18n drift check...");
try {
  sh("node scripts/check-i18n.mjs");
} catch {
  console.error(
    "\ni18n drift detected. Run `npm run check:i18n -- --fix` to stub missing keys, then translate before release.",
  );
  process.exit(1);
}
console.log("");

console.log("Building self-hosted bundle (build:release)...");
sh("npm run build:release");
console.log("");

console.log("Verifying build/ for secret leaks...");
sh("node scripts/verify-no-secrets.mjs");
console.log("");

console.log("Creating build.zip...");
try {
  sh("rm -f build.zip");
} catch {}
sh("cd build && zip -rq ../build.zip .");
const zipSize = formatBytes(statSync(ZIP_PATH).size);
console.log(`Created build.zip (${zipSize}).\n`);

const shasum = shCapture(`shasum -a 256 ${ZIP_PATH}`).split(/\s+/)[0];

// Commit list since prior tag (raw input, no formatting).
let commitsBlock = "";
try {
  const lastTag = shCapture("git describe --tags --abbrev=0").trim();
  const log = shCapture(`git log --oneline ${lastTag}..HEAD`);
  commitsBlock = log
    ? `Commits since ${lastTag}:\n${log
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n")}`
    : `No commits since ${lastTag}.`;
} catch {
  // No prior tag.
  const log = shCapture("git log --oneline -20");
  commitsBlock = `No prior tag found. Last 20 commits:\n${log
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n")}`;
}

const bar = "-".repeat(60);
console.log(bar);
console.log(`Release v${nextVersion} ready`);
console.log("");
console.log(`Artifact: build.zip (${zipSize})`);
console.log(`sha256:   ${shasum}`);
console.log("");
console.log(commitsBlock);
console.log("");
console.log("Next steps (manual):");
console.log(`  1. Review the diff and squash-merge to master`);
console.log(`  2. Tag: git tag v${nextVersion} && git push origin v${nextVersion}`);
console.log(`  3. Open a GitHub Release at v${nextVersion}`);
console.log(`  4. Write release notes in your voice (commits above are reference only)`);
console.log(`  5. Attach build.zip and paste this under it:`);
console.log(`        sha256:${shasum}`);
console.log(`  6. Build the env-baked CWS bundle separately and upload via dashboard`);
console.log(bar);

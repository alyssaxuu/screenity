#!/usr/bin/env node
// fails when git classifies a source file as binary, which happens when one
// contains raw control bytes. those files can't be diffed, so changes to them
// ship unreviewed.

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sh = (cmd) =>
  execSync(cmd, { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

const TEXT = /\.(js|jsx|ts|tsx|mjs|cjs|json|css|scss|html|md|ya?ml)$/;
const sources = sh("git ls-files src scripts").filter((f) => TEXT.test(f));
// -I omits files git considers binary, so the difference is the offenders.
// Empty files match nothing either, hence the size check.
const textual = new Set(sh("git grep -I --name-only -e '' -- src scripts"));
const offenders = sources.filter(
  (f) => !textual.has(f) && sh(`git cat-file -s :${f}`)[0] !== "0",
);

if (!offenders.length) {
  console.log(`source hygiene ok (${sources.length} files)`);
  process.exit(0);
}

console.error("Source files git treats as binary (raw control bytes):");
for (const f of offenders) console.error(`  ${f}`);
console.error("Usually an escape written as the literal byte, e.g. \\x00 in a regex.");
process.exit(1);

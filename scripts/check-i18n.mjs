#!/usr/bin/env node
// validates non-en locale parity with en/messages.json so missing keys
// don't ship as __MSG_xxx__ in the UI.
// usage: --fix copies missing en keys in as untranslated stubs.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "..", "src", "_locales");
const FIX = process.argv.includes("--fix");

const readLocale = (locale) => {
  const path = join(LOCALES_DIR, locale, "messages.json");
  return JSON.parse(readFileSync(path, "utf8"));
};

const writeLocale = (locale, data) => {
  const path = join(LOCALES_DIR, locale, "messages.json");
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
};

const en = readLocale("en");
const enKeys = new Set(Object.keys(en));

const locales = readdirSync(LOCALES_DIR).filter((name) => {
  if (name === "en") return false;
  return statSync(join(LOCALES_DIR, name)).isDirectory();
});

let totalMissing = 0;
let totalOrphan = 0;
const fixedLocales = [];

for (const locale of locales) {
  const data = readLocale(locale);
  const keys = new Set(Object.keys(data));

  const missing = [...enKeys].filter((k) => !keys.has(k));
  const orphan = [...keys].filter((k) => !enKeys.has(k));

  if (missing.length === 0 && orphan.length === 0) continue;

  console.log(`\n[${locale}]`);
  if (missing.length) {
    console.log(`  missing (${missing.length}):`);
    for (const k of missing) console.log(`    - ${k}`);
    totalMissing += missing.length;
  }
  if (orphan.length) {
    console.log(`  orphan (${orphan.length}):`);
    for (const k of orphan) console.log(`    - ${k}`);
    totalOrphan += orphan.length;
  }

  if (FIX && missing.length > 0) {
    const next = { ...data };
    for (const k of missing) {
      // Stub with en's value; revisit before shipping.
      next[k] = en[k];
    }
    writeLocale(locale, next);
    fixedLocales.push({ locale, added: missing.length });
  }
}

console.log("");
if (totalMissing === 0 && totalOrphan === 0) {
  console.log("All locales in sync with en.");
  process.exit(0);
}

console.log(
  `Summary: ${totalMissing} missing key(s), ${totalOrphan} orphan key(s) across ${locales.length} locales.`,
);

if (FIX) {
  if (fixedLocales.length) {
    console.log("\nStubbed missing keys (copied from en):");
    for (const { locale, added } of fixedLocales) {
      console.log(`  ${locale}: +${added}`);
    }
    console.log("\nReview the stubs and translate before release.");
  }
  if (totalOrphan > 0) {
    console.log("\nOrphan keys remain - review and remove if obsolete.");
    process.exit(1);
  }
  process.exit(0);
}

console.log("\nRun with --fix to stub missing keys from en.");
process.exit(1);

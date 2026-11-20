// The build says "completed successfully" even when webpack cannot link one of our
// modules, and the page renders blank (HeldTakes.jsx / heldTakes.js did this on macOS).
// Fails on a relative import that did not resolve to the export asked for:
//   npm run build:dev 2>&1 | tee /tmp/build.log | node scripts/assert-build-clean.mjs
let out = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (out += c));
process.stdin.on("end", () => {
  const bad = new Set(
    [...out.matchAll(/export '([^']+)' \(imported as '[^']+'\) was not found in '(\.{1,2}\/[^']*)'/g)].map(
      (m) => `${m[2]} has no export '${m[1]}'`,
    ),
  );
  const missing = [...out.matchAll(/Module not found: Error: Can't resolve '([^']+)'/g)].map(
    (m) => `cannot resolve ${m[1]}`,
  );
  for (const m of missing) bad.add(m);
  if (bad.size) {
    console.error("[assert-build-clean] build has unresolved imports:\n  " + [...bad].join("\n  "));
    process.exit(1);
  }
  console.log("[assert-build-clean] ok");
});

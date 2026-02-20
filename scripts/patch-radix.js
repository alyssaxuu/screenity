const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targets = [
  "node_modules/@radix-ui/react-use-callback-ref/dist/index.js",
  "node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs",
];

for (const rel of targets) {
  const p = path.join(root, rel);
  try {
    if (!fs.existsSync(p)) continue;
    let src = fs.readFileSync(p, "utf8");

    // Replace the concise optional-chaining one-liner with a guarded call
    const replaced = src.replace(
      /return\s+React\.useMemo\([\s\S]*?callbackRef\.current\?\.?\(\.\.\.args\),\s*\[\s*\]\s*\);/m,
      `return React.useMemo(() => (...args) => {\n    var _callbackRef$current;\n    if (typeof (_callbackRef$current = callbackRef.current) === 'function') {\n      return _callbackRef$current.call(callbackRef, ...args);\n    }\n  }, []);`,
    );

    if (src !== replaced) {
      fs.writeFileSync(p, replaced, "utf8");
      console.log("Patched", rel);
    } else {
      console.log("No patch needed for", rel);
    }
  } catch (err) {
    console.error("Failed to patch", rel, err);
  }
}

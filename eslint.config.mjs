import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// Deliberately narrow: correctness rules only, no style. The bug this exists to
// catch is a symbol used but never imported, which compiles fine under webpack
// and only fails at runtime.
export default [
  {
    ignores: [
      "build/**",
      "node_modules/**",
      "tests/**",
      // Vendored/generated third-party bundles.
      "src/assets/**",
      "src/pages/Editor/mediabunny/**",
      "**/*.min.js",
    ],
  },
  {
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    // The codebase carries react-hooks disable directives; registering the
    // plugin makes them resolve. Its rules stay off, this config is not a
    // style pass.
    plugins: { "react-hooks": reactHooks },
    linterOptions: {
      // Directives reference rules this config doesn't enable, which is fine.
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.worker,
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
      "no-const-assign": "error",
      "no-self-assign": "error",
      "no-cond-assign": "error",
      "no-compare-neg-zero": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "use-isnan": "error",
    },
  },
];

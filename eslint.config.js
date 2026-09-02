import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // `dist` alone only matches the top-level one; build output also lands in
  // `playground/dist`, which is gitignored but was still being linted.
  { ignores: ["**/dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain Node scripts (report/build tooling, e.g. the paper's experiment
    // harnesses). The default config defines no globals at all, so `console`
    // and friends would read as undefined here.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", performance: "readonly" },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The two classic, well-understood Rules of Hooks (the v7 plugin adds many
      // newer, more opinionated rules that flag intentional patterns here).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Pragmatic: surface these as warnings (don't fail the build) — the RDF
      // binding layer uses deliberate casts at the rdfjs/n3 boundary.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);

import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Flat config (ESLint 9+). Same rules as the previous .eslintrc.cjs.
export default defineConfig([
  globalIgnores(["dist", "node_modules", "*.config.js", "*.config.ts"]),
  {
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      // AC: no `any`. strict catches implicit; this catches explicit.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
]);

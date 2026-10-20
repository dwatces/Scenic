import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["build/**", "coverage/**", "playwright-report/**", "test-results/**"] },
  { settings: { react: { version: "detect" } } },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "react/prop-types": "off",
      "no-empty": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["*.config.js", "e2e/**/*.{js,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Playwright fixtures take `use`, which react-hooks mistakes for React's.
    files: ["e2e/**/*.{js,mjs}"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  prettier,
];

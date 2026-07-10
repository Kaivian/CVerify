import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  /**
   * Global ignores
   */
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "public/**/*.min.*",
    "next-env.d.ts",
  ]),

  /**
   * Main application rules
   */
  {
    rules: {
      /**
       * General
       */
      "no-console":
        process.env.NODE_ENV === "production"
          ? ["warn", { allow: ["warn", "error"] }]
          : "off",

      "no-debugger":
        process.env.NODE_ENV === "production" ? "warn" : "off",

      /**
       * Imports
       */
      "no-duplicate-imports": "error",

      /**
       * React
       */
      "react/jsx-key": "error",
      "react/self-closing-comp": "error",
      "react/no-unescaped-entities": "off",

      /**
       * React Hooks
       */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",

      /**
       * TypeScript
       */
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-expect-error": "allow-with-description",
        },
      ],

      /**
       * Style / Clean code
       */
      "prefer-const": "error",
      "object-shorthand": "error",
      eqeqeq: ["error", "always"],
    },
  },

  /**
   * Node.js scripts
   */
  {
    files: ["scripts/**/*.js", "scripts/**/*.ts"],

    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },

  /**
   * Config files
   */
  {
    files: [
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
      "*.config.cjs",
    ],

    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  /**
   * Test files
   */
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
    ],

    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
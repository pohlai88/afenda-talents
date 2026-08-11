import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Temporary, file-scoped baseline. Issue #9 replaces this ref mutation as part
    // of revisioned autosave; do not broaden or copy this exception.
    files: ["src/components/assessment-form.tsx"],
    rules: {
      "react-hooks/refs": "off",
    },
  },
  {
    // Temporary verification module pending extraction under issue #4. These
    // exceptions disappear when the module moves to its named-user application.
    files: [
      "src/components/employee-verification-form.tsx",
      "src/components/verification-admin.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/components/verification-admin.tsx"],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

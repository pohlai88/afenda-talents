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
    // TanStack Table deliberately exposes non-memoizable functions. React Compiler
    // skips this component safely; the registry rewrite in issue #10 removes most
    // client table state and will revisit this exception.
    files: ["src/components/candidates/candidates-datatable.tsx"],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // These four imports/types are legacy response-contract scaffolding in the
    // round manager. Keep the exception exact rather than disabling unused checks.
    files: ["src/components/rounds/round-manager.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern:
            "^(Role|userCreateResponseSchema|userPatchResponseSchema|UserPatchPayload)$",
        },
      ],
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

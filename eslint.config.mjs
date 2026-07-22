import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Supabase Storage signed URLs are dynamic and can't use next/image.
    files: [
      "src/components/AttachmentList.tsx",
      "src/components/CommentList.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // This rule historically recommended `&apos;` to "fix" unescaped
    // apostrophes, but JSX doesn't decode HTML entities — `&apos;`
    // rendered literally as "&apos;" in the browser, which was a real
    // user-visible bug. Allow `'` for natural prose; keep protections
    // for `>` `}` and `"` which can legitimately break JSX parsing
    // or layout. Pattern matches both .tsx and .jsx so future additions
    // don't inadvertently fall back to the broken default.
    files: ["**/*.{tsx,jsx}"],
    rules: {
      "react/no-unescaped-entities": [
        "error",
        { forbid: [">", "\"", "}"] },
      ],
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

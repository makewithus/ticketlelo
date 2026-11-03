import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals.map((conf) => {
    if (conf.plugins?.["react-hooks"]) {
      return {
        ...conf,
        rules: {
          ...conf.rules,
          "react-hooks/set-state-in-effect": "warn",
          "react-hooks/purity": "warn",
        },
      };
    }
    return conf;
  }),
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

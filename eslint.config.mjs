import { config as baseConfig } from "@workspace/eslint-config/base";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/generated/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/.turbo/**",
    ],
  },
  ...baseConfig,
];

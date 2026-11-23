// @ts-check
import hakorem from '@hakorem/lint-tokens/stylelint';

/** @type {import('stylelint').Config} */
export default {
  plugins: [hakorem],
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-investor/**',
    '**/storybook-static/**',
    '**/generated/**',
  ],
  rules: {
    'hakorem/token-usage': true,
  },
};

// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import hakorem from '@hakorem/lint-tokens/eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/storybook-static/**',
      '**/generated/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      // A scrollable table region must be focusable so keyboard users can scroll it (axe: scrollable-region-focusable).
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { tags: [], roles: ['tabpanel', 'region'], allowExpressionValues: true },
      ],
    },
  },
  {
    // Colour tokens: role-checked, no raw colours, marketing tokens scoped.
    files: ['**/*.{ts,tsx,js,mjs}'],
    ignores: ['tooling/lint-tokens/**'],
    plugins: { hakorem },
    rules: { 'hakorem/token-usage': 'error' },
  },
);

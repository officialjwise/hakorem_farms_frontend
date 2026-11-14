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
      '**/.next/**',
      '**/storybook-static/**',
      '**/generated/**',
      '**/coverage/**',
      // Written by Next on every build; it carries the triple-slash references Next needs (ADR 0015).
      '**/next-env.d.ts',
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
    // Table parts carry explicit ARIA table roles on purpose: the stacked layout changes
    // their CSS display, which can drop native table semantics in some browsers.
    files: ['packages/ui/src/components/table/Table.tsx'],
    rules: {
      'jsx-a11y/no-redundant-roles': 'off',
      // jsx-a11y classes <td> as interactive (gridcell); here it is a plain table cell.
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'off',
    },
  },
  {
    // Combobox option rows are role="option" on the same element as the onClick, reached through
    // aria-activedescendant while focus stays in the input (ARIA APG combobox, ADR 0010), so keys
    // never reach a row. click-events-have-key-events checks the element type, not its ARIA role,
    // and jsx-a11y has had no release since 2024 (ADR 0002). axe in Storybook stays the gate, and
    // interactive-supports-focus still runs here and passes (tabIndex={-1}).
    files: ['packages/ui/src/components/combobox/Combobox.tsx'],
    rules: { 'jsx-a11y/click-events-have-key-events': 'off' },
  },
  {
    // Colour tokens: role-checked, no raw colours, marketing tokens scoped.
    files: ['**/*.{ts,tsx,js,mjs}'],
    ignores: ['tooling/lint-tokens/**'],
    plugins: { hakorem },
    rules: { 'hakorem/token-usage': 'error' },
  },
);

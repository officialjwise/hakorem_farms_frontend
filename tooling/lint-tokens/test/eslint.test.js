import { describe, it, after } from 'node:test';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import plugin from '../src/eslint.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.afterAll = after;

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const rule = plugin.rules['token-usage'];
const APP = '/repo/packages/ui/src/components/badge/Badge.tsx';
const PROMO = '/repo/apps/storefront/src/marketing/Hero.tsx';
const err = { messageId: 'violation' };

tester.run('token-usage', rule, {
  valid: [
    // Mark tokens in their own roles: lines and glyphs.
    { filename: APP, code: `<span className="border border-good" />` },
    { filename: APP, code: `<svg className="stroke-good fill-critical" />` },
    { filename: APP, code: `<td className="edge-accent ring-focus outline-focus" />` },
    // The text and fill companions of a status.
    { filename: APP, code: `<span className="bg-good-subtle text-good-fg" />` },
    {
      filename: APP,
      code: `<span className="bg-good-strong text-good-on hover:bg-critical-strong-hover" />`,
    },
    // Variants and non-colour utilities are ignored.
    {
      filename: APP,
      code: `cn('text-sm', 'hover:text-fg', 'md:bg-surface', '[&_svg]:size-icon-md')`,
    },
    { filename: APP, code: `const style = { color: 'var(--fg)', borderColor: 'var(--good)' }` },
    { filename: APP, code: `<div style={{ fill: 'var(--warning)' }} />` },
    // Non-colour arbitrary values are fine.
    { filename: APP, code: `<div className="w-[37%] grid-cols-[1fr_auto]" />` },
    // Marketing tokens inside marketing code.
    { filename: PROMO, code: `<section className="bg-brand-marketing text-brand-marketing-fg" />` },
    // The palette source of truth may hold hex values.
    { filename: '/repo/packages/ui/src/tokens/palette.ts', code: `const fg = '#221E16'` },
    // A bare token name is data, not a class (even "accent-fg", which looks like accent-color).
    { filename: APP, code: `const pair = { fg: 'accent-fg', bg: 'accent', mark: 'good' }` },
    // Copy that merely contains a hash and digits.
    { filename: APP, code: `const label = 'Order #12345 is ready'` },
  ],
  invalid: [
    // The point of the rule: a mark token used as text or as a fill behind text.
    { filename: APP, code: `<span className="text-good" />`, errors: [err] },
    { filename: APP, code: `<span className="bg-good" />`, errors: [err] },
    { filename: APP, code: `<span className="hover:bg-critical" />`, errors: [err] },
    { filename: APP, code: `cn('px-2', 'text-violet')`, errors: [err] },
    { filename: APP, code: 'const c = `text-${x} bg-warning`', errors: [err] },
    // Escape routes: arbitrary values, inline styles, aliasing.
    { filename: APP, code: `<span className="text-[var(--good)]" />`, errors: [err] },
    { filename: APP, code: `<span className="bg-(--good)" />`, errors: [err] },
    { filename: APP, code: `<span className="[color:var(--good)]" />`, errors: [err] },
    { filename: APP, code: `<span style={{ color: 'var(--good)' }} />`, errors: [err] },
    {
      filename: APP,
      code: `<span style={{ backgroundColor: 'var(--critical)' }} />`,
      errors: [err],
    },
    { filename: APP, code: `<span style={{ '--x': 'var(--good)' }} />`, errors: [err] },
    // Contrast-changing opacity on a token.
    { filename: APP, code: `<span className="bg-good-subtle/50" />`, errors: [err] },
    // Raw colours, and the disabled Tailwind palette.
    { filename: APP, code: `const brand = '#0D5C55'`, errors: [err] },
    { filename: APP, code: `<span className="bg-[#ff0000]" />`, errors: [err] },
    { filename: APP, code: `<span style={{ color: 'rgb(0 0 0)' }} />`, errors: [err] },
    { filename: APP, code: `<span className="text-green-700 bg-white" />`, errors: [err, err] },
    // Marketing tokens outside marketing code.
    { filename: APP, code: `<section className="bg-brand-marketing" />`, errors: [err] },
    {
      filename: '/repo/apps/console/src/pos/Sale.tsx',
      code: `<b className="text-brand-marketing-fg" />`,
      errors: [err],
    },
  ],
});

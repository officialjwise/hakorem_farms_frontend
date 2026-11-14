import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import stylelint from 'stylelint';
import plugin from '../src/stylelint.js';

const config = { plugins: [plugin], rules: { 'hakorem/token-usage': true } };

async function lint(code, codeFilename = '/repo/packages/ui/src/styles/foundation.css') {
  const { results } = await stylelint.lint({ code, codeFilename, config });
  return results[0].warnings.map((w) => w.text);
}

describe('stylelint hakorem/token-usage', () => {
  it('accepts tokens in their roles', async () => {
    const out = await lint(`
      .a { color: var(--fg); background-color: var(--surface); }
      .b { border: 1px solid var(--good); outline-color: var(--focus); }
      .c { fill: var(--critical); stroke: var(--info); }
      .d { @apply bg-good-subtle text-good-fg border-good; }
    `);
    assert.deepEqual(out, []);
  });

  it('rejects a mark token as text or as a fill', async () => {
    const out = await lint(`.a { color: var(--good); } .b { background: var(--warning); }`);
    assert.equal(out.length, 2);
    assert.match(out[0], /cannot be used as text.*good-fg/);
    assert.match(out[1], /cannot be used as a fill behind text.*warning-subtle.*warning-strong/);
  });

  it('rejects mark tokens through @apply', async () => {
    const out = await lint(`.a { @apply text-critical; }`);
    assert.equal(out.length, 1);
  });

  it('rejects aliasing a token into another custom property', async () => {
    const out = await lint(`.a { --status: var(--good); }`);
    assert.equal(out.length, 1);
    assert.match(out[0], /do not alias/);
  });

  it('rejects raw colours outside the palette', async () => {
    const out = await lint(`.a { color: #fff; } .b { background: oklch(0.5 0.1 120); }`);
    assert.equal(out.length, 2);
  });

  it('keeps marketing tokens in marketing code', async () => {
    const css = `.hero { background: var(--brand-marketing); color: var(--brand-marketing-fg); }`;
    assert.equal((await lint(css)).length, 2);
    assert.deepEqual(await lint(css, '/repo/apps/storefront/src/marketing/hero.css'), []);
  });
});

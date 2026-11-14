import { describe, expect, it } from 'vitest';
import { LANGUAGES, NAMESPACES, catalogue, createI18n } from './index';

function leafStrings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leafStrings(v, path ? `${path}.${k}` : k));
  }
  throw new Error(`Catalogue value at "${path}" is not a string or a group.`);
}

async function load(language: (typeof LANGUAGES)[number], ns: (typeof NAMESPACES)[number]) {
  return (await catalogue[language][ns]()).default;
}

describe('translation layer', () => {
  it('translates a label from the requested namespace', async () => {
    const i18n = await createI18n({ namespaces: ['common'] });
    expect(i18n.t('field.required')).toBe('Required');
    expect(i18n.t('error.tryAgain')).toBe('Try again');
    expect(i18n.hasLoadedNamespace('common')).toBe(true);
  });

  it('creates a separate instance each time, never the global singleton', async () => {
    const a = await createI18n({ namespaces: ['common'] });
    const b = await createI18n({ namespaces: ['common'] });
    expect(a).not.toBe(b);
  });

  it('has a catalogue file for every namespace in every language', () => {
    for (const language of LANGUAGES) {
      for (const ns of NAMESPACES) expect(typeof catalogue[language][ns]).toBe('function');
    }
  });

  it('has the same keys in every language as in the default', async () => {
    for (const ns of NAMESPACES) {
      const keys = leafStrings(await load('en', ns))
        .map(([k]) => k)
        .sort();
      for (const language of LANGUAGES) {
        expect(
          leafStrings(await load(language, ns))
            .map(([k]) => k)
            .sort(),
        ).toEqual(keys);
      }
    }
  });

  it('carries labels only: no number, currency or date formatting in any string', async () => {
    const formatting = /\{\{[^}]*,\s*(number|currency|datetime|relativetime|list)\b/i;
    for (const language of LANGUAGES) {
      for (const ns of NAMESPACES) {
        for (const [key, text] of leafStrings(await load(language, ns))) {
          expect(formatting.test(text), `${language}/${ns}:${key} formats a value`).toBe(false);
        }
      }
    }
  });
});

describe('app namespaces (F1)', () => {
  it('translates from the shell, auth and storefront namespaces', async () => {
    const i18n = await createI18n({ namespaces: ['shell', 'auth', 'storefront'] });
    expect(i18n.t('toast.close', { ns: 'shell' })).toBe('Dismiss notification');
    expect(i18n.t('login.submit', { ns: 'auth' })).toBe('Sign in');
    expect(i18n.t('cart.title', { ns: 'storefront' })).toBe('Your cart');
  });
});

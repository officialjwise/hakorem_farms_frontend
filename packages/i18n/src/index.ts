/**
 * The translation layer (ADR 0008): react-i18next, one catalogue shared by the
 * storefront (Next.js) and the console (Vite), split by namespace.
 *
 * Labels only. Numbers, money and weight never pass through translation; they
 * are formatted by formatMoney and formatWeight in @hakorem/ui (ADR 0007).
 * packages/ui never imports this: apps call t() and pass strings in as props.
 */
import i18next, { type BackendModule, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import type common from '../locales/en/common.json';

export const LANGUAGES = ['en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * One file per namespace per language. Each loads by dynamic import, so the
 * bundler splits it into its own chunk and a page downloads only the
 * namespaces it asks for. Add a namespace here and in every language.
 */
export const NAMESPACES = ['common'] as const;
export type Namespace = (typeof NAMESPACES)[number];

type Catalogue = Record<string, unknown>;

export const catalogue: Record<
  Language,
  Record<Namespace, () => Promise<{ default: Catalogue }>>
> = {
  en: {
    common: () => import('../locales/en/common.json'),
  },
};

const catalogueBackend: BackendModule = {
  type: 'backend',
  init: () => undefined,
  read(language, namespace, callback) {
    const load = catalogue[language as Language]?.[namespace as Namespace];
    if (load === undefined) {
      callback(new Error(`No catalogue for ${language}/${namespace}.`), false);
      return;
    }
    load().then(
      (module) => callback(null, module.default),
      (error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error)), false),
    );
  },
};

export interface CreateI18nOptions {
  language?: Language;
  /** The namespaces this app or page needs up front. Load more later with `instance.loadNamespaces`. */
  namespaces: readonly Namespace[];
}

/**
 * A fresh i18next instance per app (and per request on the server), never the
 * global singleton, so server renders cannot leak language between requests.
 * Apps wrap their tree in react-i18next's I18nextProvider with it.
 */
export async function createI18n({
  language = DEFAULT_LANGUAGE,
  namespaces,
}: CreateI18nOptions): Promise<i18n> {
  const instance = i18next.createInstance();
  await instance
    .use(catalogueBackend)
    .use(initReactI18next)
    .init({
      lng: language,
      supportedLngs: [...LANGUAGES],
      fallbackLng: DEFAULT_LANGUAGE,
      ns: [...namespaces],
      defaultNS: 'common',
      // React escapes output already.
      interpolation: { escapeValue: false },
    });
  return instance;
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common };
  }
}

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
import type approvalsNs from '../locales/en/approvals.json';
import type billingNs from '../locales/en/billing.json';
import type buyingNs from '../locales/en/buying.json';
import type payablesNs from '../locales/en/payables.json';
import type wholesaleNs from '../locales/en/wholesale.json';
import type driverNs from '../locales/en/driver.json';
import type fulfilmentNs from '../locales/en/fulfilment.json';
import type posNs from '../locales/en/pos.json';
import type posShiftNs from '../locales/en/posShift.json';
import type refusalsNs from '../locales/en/refusals.json';
import type audit from '../locales/en/audit.json';
import type auth from '../locales/en/auth.json';
import type catalogueNs from '../locales/en/catalogue.json';
import type stockNs from '../locales/en/stock.json';
import type dashboardNs from '../locales/en/dashboard.json';
import type branchesNs from '../locales/en/branches.json';
import type labelsNs from '../locales/en/labels.json';
import type listsNs from '../locales/en/lists.json';
import type reportsNs from '../locales/en/reports.json';
import type settingsNs from '../locales/en/settings.json';
import type livestockNs from '../locales/en/livestock.json';
import type processingNs from '../locales/en/processing.json';
import type common from '../locales/en/common.json';
import type iam from '../locales/en/iam.json';
import type shell from '../locales/en/shell.json';
import type storefront from '../locales/en/storefront.json';

export const LANGUAGES = ['en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * One file per namespace per language. Each loads by dynamic import, so the
 * bundler splits it into its own chunk and a page downloads only the
 * namespaces it asks for. Add a namespace here and in every language.
 */
export const NAMESPACES = [
  'common',
  'shell',
  'auth',
  'storefront',
  'iam',
  'audit',
  'catalogue',
  'stock',
  'dashboard',
  'branches',
  'labels',
  'lists',
  'reports',
  'settings',
  'livestock',
  'processing',
  'approvals',
  'billing',
  'pos',
  'posShift',
  'buying',
  'payables',
  'wholesale',
  'fulfilment',
  'driver',
  'refusals',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

type Catalogue = Record<string, unknown>;

export const catalogue: Record<
  Language,
  Record<Namespace, () => Promise<{ default: Catalogue }>>
> = {
  en: {
    common: () => import('../locales/en/common.json'),
    shell: () => import('../locales/en/shell.json'),
    auth: () => import('../locales/en/auth.json'),
    storefront: () => import('../locales/en/storefront.json'),
    iam: () => import('../locales/en/iam.json'),
    audit: () => import('../locales/en/audit.json'),
    catalogue: () => import('../locales/en/catalogue.json'),
    stock: () => import('../locales/en/stock.json'),
    dashboard: () => import('../locales/en/dashboard.json'),
    branches: () => import('../locales/en/branches.json'),
    labels: () => import('../locales/en/labels.json'),
    lists: () => import('../locales/en/lists.json'),
    reports: () => import('../locales/en/reports.json'),
    settings: () => import('../locales/en/settings.json'),
    livestock: () => import('../locales/en/livestock.json'),
    processing: () => import('../locales/en/processing.json'),
    approvals: () => import('../locales/en/approvals.json'),
    billing: () => import('../locales/en/billing.json'),
    pos: () => import('../locales/en/pos.json'),
    posShift: () => import('../locales/en/posShift.json'),
    buying: () => import('../locales/en/buying.json'),
    payables: () => import('../locales/en/payables.json'),
    wholesale: () => import('../locales/en/wholesale.json'),
    fulfilment: () => import('../locales/en/fulfilment.json'),
    driver: () => import('../locales/en/driver.json'),
    refusals: () => import('../locales/en/refusals.json'),
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
    resources: {
      common: typeof common;
      shell: typeof shell;
      auth: typeof auth;
      storefront: typeof storefront;
      iam: typeof iam;
      audit: typeof audit;
      catalogue: typeof catalogueNs;
      stock: typeof stockNs;
      dashboard: typeof dashboardNs;
      branches: typeof branchesNs;
      labels: typeof labelsNs;
      lists: typeof listsNs;
      reports: typeof reportsNs;
      settings: typeof settingsNs;
      livestock: typeof livestockNs;
      processing: typeof processingNs;
      approvals: typeof approvalsNs;
      billing: typeof billingNs;
      pos: typeof posNs;
      posShift: typeof posShiftNs;
      buying: typeof buyingNs;
      payables: typeof payablesNs;
      wholesale: typeof wholesaleNs;
      fulfilment: typeof fulfilmentNs;
      driver: typeof driverNs;
      refusals: typeof refusalsNs;
    };
  }
}

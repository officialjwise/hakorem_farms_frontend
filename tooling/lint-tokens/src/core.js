// @ts-check
/**
 * Shared checks behind the ESLint and Stylelint `hakorem/token-usage` rules.
 *
 * The token manifest (generated from packages/ui/src/tokens/palette.ts) says
 * which roles each colour token may play. These checks reject every way of
 * using a token outside its roles, every raw colour literal, and every
 * marketing token used outside marketing code.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @typedef {'text' | 'surface' | 'line' | 'glyph'} Role */
/** @typedef {{ roles: Role[], scope: 'app' | 'marketing' | 'storefront' }} TokenInfo */
/** @typedef {{ utilityRoles: Record<string, Role>, tokens: Record<string, TokenInfo> }} Manifest */
/** @typedef {{ message: string }} Violation */
/**
 * @typedef {object} Context
 * @property {string} filename Absolute or repo-relative path of the file being linted.
 * @property {RegExp} [marketingPaths] Files allowed to use marketing-scoped tokens.
 * @property {RegExp} [storefrontPaths] Files allowed to use storefront-scoped tokens.
 * @property {RegExp} [rawColorPaths] Files allowed to contain raw colour literals.
 */

/** @returns {Manifest} */
export function loadManifest() {
  return JSON.parse(readFileSync(require.resolve('@hakorem/ui/token-manifest.json'), 'utf8'));
}

const manifest = loadManifest();
const TOKENS = manifest.tokens;
const UTILITY_ROLES = manifest.utilityRoles;
const PREFIXES = Object.keys(UTILITY_ROLES).sort((a, b) => b.length - a.length);

/** Colour-taking Tailwind prefixes that HaKorem deliberately does not generate for tokens. */
const UNSUPPORTED_COLOR_PREFIXES = [
  'inset-shadow',
  'drop-shadow',
  'text-shadow',
  'inset-ring',
  'placeholder',
  'shadow',
  'accent',
  'from',
  'via',
  'to',
];

const TAILWIND_PALETTE =
  /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}$|^(white|black)$/;
const ALL_COLOR_PREFIXES = [...PREFIXES, ...UNSUPPORTED_COLOR_PREFIXES].sort(
  (a, b) => b.length - a.length,
);

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/i;
const WHOLE_HEX = /^#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})$/i;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const TOKEN_VAR = /var\(\s*--([a-z0-9-]+)|\(--([a-z0-9-]+)\)/gi;

const DEFAULT_MARKETING_PATHS =
  /(^|\/)(apps\/storefront\/src\/marketing|packages\/ui\/src\/marketing)\//;
/** The public shop, where its own page surfaces may be used (ADR 0040). */
const DEFAULT_STOREFRONT_PATHS = /(^|\/)apps\/storefront\//;
/** The palette source of truth, and the generator that turns it into CSS. */
const DEFAULT_RAW_COLOR_PATHS = /(^|\/)packages\/ui\/src\/tokens\/(palette|render)\.ts$/;

const ROLE_WORD = {
  text: 'text',
  surface: 'a fill behind text',
  line: 'a line or border',
  glyph: 'an icon fill or stroke',
};

/**
 * @param {string} name
 * @param {Role} role
 */
function suggestion(name, role) {
  const s = [];
  if (role === 'text' && TOKENS[`${name}-fg`]) s.push(`"${name}-fg"`);
  if (role === 'surface') {
    if (TOKENS[`${name}-subtle`]) s.push(`"${name}-subtle"`);
    if (TOKENS[`${name}-strong`]) s.push(`"${name}-strong"`);
  }
  return s.length ? ` Use ${s.join(' or ')} instead.` : '';
}

/**
 * @param {string} name
 * @param {Role} role
 * @param {string} where
 * @param {Context} ctx
 * @returns {Violation[]}
 */
function checkTokenRole(name, role, where, ctx) {
  const token = TOKENS[name];
  if (!token) return [];
  const out = [];
  if (!token.roles.includes(role)) {
    out.push({
      message:
        `${where}: "--${name}" cannot be used as ${ROLE_WORD[role]}. ` +
        `It is a ${token.roles.join(' + ')} token.${suggestion(name, role)}`,
    });
  }
  out.push(...checkScope(name, where, ctx));
  return out;
}

/**
 * @param {string} name
 * @param {string} where
 * @param {Context} ctx
 * @returns {Violation[]}
 */
function checkScope(name, where, ctx) {
  const token = TOKENS[name];
  if (token?.scope === 'storefront') {
    const shop = ctx.storefrontPaths ?? DEFAULT_STOREFRONT_PATHS;
    if (shop.test(normalise(ctx.filename))) return [];
    return [
      {
        message:
          `${where}: "--${name}" is a storefront token, the public shop's own page surfaces (ADR 0040). ` +
          `Only apps/storefront may use it; the console and the design system use the app surfaces.`,
      },
    ];
  }
  if (!token || token.scope !== 'marketing') return [];
  const allowed = ctx.marketingPaths ?? DEFAULT_MARKETING_PATHS;
  if (allowed.test(normalise(ctx.filename))) return [];
  return [
    {
      message:
        `${where}: "--${name}" is a marketing token, reserved for storefront hero and promotional ` +
        `surfaces. The console, POS and the rest of the storefront use the pine accent.`,
    },
  ];
}

/** @param {string} p */
function normalise(p) {
  return p.replaceAll('\\', '/');
}

/** @param {Context} ctx */
function rawColorAllowed(ctx) {
  return (ctx.rawColorPaths ?? DEFAULT_RAW_COLOR_PATHS).test(normalise(ctx.filename));
}

/** Split a class string on whitespace, then strip variants (`hover:`, `md:`, `[&_svg]:`) from each class. */
/** @param {string} cls */
function baseUtility(cls) {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < cls.length; i++) {
    const ch = cls[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) cut = i + 1;
  }
  return cls.slice(cut).replace(/^!|!$/g, '').replace(/^-/, '');
}

/**
 * Check every Tailwind class in a string.
 * @param {string} value
 * @param {Context} ctx
 * @returns {Violation[]}
 */
export function checkClassString(value, ctx) {
  /** @type {Violation[]} */
  const out = [];
  for (const cls of value.split(/\s+/).filter(Boolean)) {
    const util = baseUtility(cls);
    const arbitrary = /[[(]/.test(util);

    if (arbitrary) {
      if (!rawColorAllowed(ctx) && (HEX.test(util) || COLOR_FUNCTION.test(util))) {
        out.push({
          message: `"${cls}": raw colour in an arbitrary value. Use a colour token utility.`,
        });
      }
      for (const m of util.matchAll(TOKEN_VAR)) {
        const name = m[1] ?? m[2];
        if (name && TOKENS[name]) {
          out.push({
            message:
              `"${cls}": colour tokens cannot be passed as arbitrary values, because that skips the ` +
              `role check. Use the generated utility (for example "border-${name}").`,
          });
          out.push(...checkScope(name, `"${cls}"`, ctx));
        }
      }
      continue;
    }

    const [body, opacity] = util.split('/');
    if (!body) continue;
    // A bare token name ('accent-fg', 'good-subtle') is a name, not a utility.
    if (cls === body && TOKENS[body]) continue;
    const prefix = ALL_COLOR_PREFIXES.find((p) => body.startsWith(`${p}-`));
    if (!prefix) continue;
    const name = body.slice(prefix.length + 1);

    if (TAILWIND_PALETTE.test(name)) {
      out.push({
        message: `"${cls}": the Tailwind palette is disabled. Use a HaKorem colour token.`,
      });
      continue;
    }
    if (!TOKENS[name]) continue;

    if (opacity !== undefined) {
      out.push({
        message: `"${cls}": opacity modifiers change a token's contrast and are not allowed. Use a token that already has the colour you need.`,
      });
    }
    const role = UTILITY_ROLES[prefix];
    if (!role) {
      out.push({
        message: `"${cls}": colour tokens are not available for "${prefix}-*" utilities.`,
      });
      continue;
    }
    out.push(...checkTokenRole(name, role, `"${cls}"`, ctx));
  }
  return out;
}

/**
 * The role a CSS property needs from a colour token, or null when a token
 * colour has no business in that property at all.
 * @param {string} prop
 * @returns {Role | null}
 */
export function roleForProperty(prop) {
  const p = prop.toLowerCase();
  if (
    [
      'color',
      'caret-color',
      'text-decoration-color',
      '-webkit-text-fill-color',
      'text-emphasis-color',
    ].includes(p)
  )
    return 'text';
  if (['background', 'background-color', 'background-image', 'accent-color'].includes(p))
    return 'surface';
  if (
    /^border(-|$)/.test(p) ||
    /^outline(-|$)/.test(p) ||
    p === 'box-shadow' ||
    p === 'column-rule-color'
  )
    return 'line';
  if (p === '--tw-ring-color' || p === '--tw-ring-offset-color') return 'line';
  if (p === 'fill' || p === 'stroke' || p === 'stop-color' || p === 'flood-color') return 'glyph';
  return null;
}

/**
 * Check one CSS declaration (also used for React inline style objects).
 * @param {string} prop kebab-case property, or a custom property
 * @param {string} value
 * @param {Context} ctx
 * @returns {Violation[]}
 */
export function checkDeclaration(prop, value, ctx) {
  /** @type {Violation[]} */
  const out = [];
  if (!rawColorAllowed(ctx) && (HEX.test(value) || COLOR_FUNCTION.test(value))) {
    out.push({ message: `"${prop}: ${value}": raw colour value. Use a colour token.` });
  }
  for (const m of value.matchAll(TOKEN_VAR)) {
    const name = m[1] ?? m[2];
    if (!name || !TOKENS[name]) continue;
    const role = roleForProperty(prop);
    if (role === null) {
      out.push({
        message: prop.startsWith('--')
          ? `"${prop}": do not alias colour tokens into other custom properties, because that skips the role check.`
          : `"${prop}": colour token "--${name}" has no valid use in this property.`,
      });
      out.push(...checkScope(name, `"${prop}"`, ctx));
      continue;
    }
    out.push(...checkTokenRole(name, role, `"${prop}: ${value}"`, ctx));
  }
  return out;
}

/**
 * A plain string anywhere in TS/TSX source that is just a hex colour.
 * @param {string} value
 * @param {Context} ctx
 */
export function isForbiddenHexString(value, ctx) {
  return !rawColorAllowed(ctx) && WHOLE_HEX.test(value.trim());
}

/** @param {string} camel */
export function kebab(camel) {
  if (camel.startsWith('--')) return camel;
  return camel.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, '-$1-');
}

// @ts-check
/**
 * ESLint plugin: `hakorem/token-usage`.
 *
 * Checks every string in TS/TSX source for Tailwind classes that misuse a colour
 * token, every object property that looks like a CSS colour property (inline
 * styles), and any bare hex colour string.
 */
import {
  checkClassString,
  checkDeclaration,
  isForbiddenHexString,
  kebab,
  roleForProperty,
} from './core.js';

/**
 * @typedef {{ marketingPaths?: string, rawColorPaths?: string }} Options
 */

/** @type {import('eslint').Rule.RuleModule} */
const tokenUsage = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Colour tokens are used only in the roles they allow, raw colours never appear, and marketing tokens stay in marketing code.',
    },
    schema: [
      {
        type: 'object',
        properties: { marketingPaths: { type: 'string' }, rawColorPaths: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    messages: { violation: '{{message}}' },
  },
  create(context) {
    /** @type {Options} */
    const opts = context.options[0] ?? {};
    const ctx = {
      filename: context.filename,
      ...(opts.marketingPaths ? { marketingPaths: new RegExp(opts.marketingPaths) } : {}),
      ...(opts.rawColorPaths ? { rawColorPaths: new RegExp(opts.rawColorPaths) } : {}),
    };
    /** @type {Set<string>} */
    const seen = new Set();

    /**
     * @param {import('estree').Node} node
     * @param {{ message: string }[]} violations
     */
    function report(node, violations) {
      for (const v of violations) {
        const key = `${node.range?.[0]}:${v.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        context.report({ node, messageId: 'violation', data: { message: v.message } });
      }
    }

    /**
     * @param {import('estree').Node} node
     * @param {string} text
     */
    function checkString(node, text) {
      if (isForbiddenHexString(text, ctx)) {
        report(node, [{ message: `"${text}": raw hex colour. Use a colour token.` }]);
        return;
      }
      report(node, checkClassString(text, ctx));
    }

    /**
     * The CSS property a style-object key names, or null if the key is not one.
     * @param {import('estree').Property} node
     */
    function cssProperty(node) {
      if (node.key.type !== 'Identifier' && node.key.type !== 'Literal') return null;
      const prop = kebab(node.key.type === 'Identifier' ? node.key.name : String(node.key.value));
      return roleForProperty(prop) !== null || prop.startsWith('--') ? prop : null;
    }

    /** Style-object values are checked as declarations by `Property`, not as class strings. */
    /** @param {import('estree').Node & { parent?: import('estree').Node }} node */
    function isStyleValue(node) {
      const parent = node.parent;
      if (parent?.type === 'TemplateLiteral') return isStyleValue(parent);
      return (
        parent?.type === 'Property' &&
        (parent.key === node || (parent.value === node && cssProperty(parent) !== null))
      );
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string' && !isStyleValue(node)) checkString(node, node.value);
      },
      TemplateElement(node) {
        if (!isStyleValue(node)) checkString(node, node.value.cooked ?? node.value.raw);
      },
      Property(node) {
        const prop = cssProperty(node);
        if (prop === null) return;
        let value = null;
        if (node.value.type === 'Literal' && typeof node.value.value === 'string')
          value = node.value.value;
        else if (node.value.type === 'TemplateLiteral')
          value = node.value.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
        if (value !== null) report(node.value, checkDeclaration(prop, value, ctx));
      },
    };
  },
};

const plugin = {
  meta: { name: '@hakorem/lint-tokens' },
  rules: { 'token-usage': tokenUsage },
};

export default plugin;

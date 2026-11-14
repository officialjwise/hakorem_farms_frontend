// @ts-check
/**
 * Stylelint plugin: `hakorem/token-usage`. The CSS side of the ESLint rule:
 * declarations, and class lists inside `@apply`.
 */
import stylelint from 'stylelint';
import { checkClassString, checkDeclaration } from './core.js';

const ruleName = 'hakorem/token-usage';
const messages = stylelint.utils.ruleMessages(ruleName, {
  violation: (/** @type {string} */ message) => message,
});

/** @type {import('stylelint').Rule} */
const rule = (primary, secondary) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!valid || !primary) return;
  /** @type {{ marketingPaths?: string, rawColorPaths?: string }} */
  const opts = secondary ?? {};
  const ctx = {
    filename: root.source?.input.file ?? '',
    ...(opts.marketingPaths ? { marketingPaths: new RegExp(opts.marketingPaths) } : {}),
    ...(opts.rawColorPaths ? { rawColorPaths: new RegExp(opts.rawColorPaths) } : {}),
  };

  root.walkDecls((decl) => {
    for (const v of checkDeclaration(decl.prop, decl.value, ctx)) {
      stylelint.utils.report({
        ruleName,
        result,
        node: decl,
        message: messages.violation(v.message),
      });
    }
  });
  root.walkAtRules('apply', (atRule) => {
    for (const v of checkClassString(atRule.params, ctx)) {
      stylelint.utils.report({
        ruleName,
        result,
        node: atRule,
        message: messages.violation(v.message),
      });
    }
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);

/*
 * Requires a literal fallback on a theme `var()`, and adds it. Until
 * `initThemeCssVariables()` has run the variables are undefined, and an
 * undefined custom property makes its whole declaration invalid, so styles
 * shipped from the KDS repository cannot rely on them alone.
 */

const stylelint = require('stylelint');
const valueParser = require('postcss-value-parser');

const {
  atRuleParamsIndex,
  declarationValueIndex,
  getThemeCssVariableValues,
  isThemedCustomProperty,
  suggestThemeCssVariableName,
} = require('../themeCssVariableNames');

const ruleName = 'kds/require-theme-var-fallback';

const messages = stylelint.utils.ruleMessages(ruleName, {
  expected: (name, value) => `Expected "var(${name})" to fall back to "${value}"`,
  mismatch: (name, written, value) =>
    `Expected "var(${name})" to fall back to "${value}", not "${written}"`,
});

const meta = {
  url: 'https://github.com/learningequality/kolibri-design-system/blob/develop/lint/README.md',
  fixable: true,
};

const rule = (primary, secondary, context) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!validOptions) {
      return;
    }

    const values = getThemeCssVariableValues();

    const handleMissingFallbacks = (node, property, valueIndex) => {
      const parsed = valueParser(node[property]);
      // postcss keeps a comment written inside a value in `raws`, which rewriting
      // the value would drop, so this declaration is only reported, to be fixed by hand
      const canFix = context.fix && !node.raws[property];
      let rewritten = false;
      parsed.walk(valueNode => {
        if (valueNode.type !== 'function' || valueNode.value.toLowerCase() !== 'var') {
          return;
        }
        const [nameNode, ...fallback] = valueNode.nodes;
        // a name the theme does not emit has no value to fall back to and
        // should be reported by `kds/no-unknown-theme-custom-properties`
        if (!nameNode || !isThemedCustomProperty(nameNode.value)) {
          return;
        }
        /*
         * A source `v_N` version key is corrected to the emitted `vN` by
         * `kds/no-unknown-theme-custom-properties`, which may not have run yet, so
         * resolve it here too, rather than depending on the order the rules run in.
         */
        const emitted = values.has(nameNode.value)
          ? nameNode.value
          : suggestThemeCssVariableName(nameNode.value);
        const known = emitted && values.get(emitted);
        if (!known) {
          return;
        }
        // prettier lowercases hex, so emitting it lowercase keeps the fix stable
        const value = known.toLowerCase();
        // a fallback that is not a single literal, such as a nested `var()` chain,
        // is deliberate and left alone
        const literal = fallback.length === 2 && fallback[1].type === 'word' && fallback[1];
        // `transparent`, `currentColor` or a SCSS variable is a deliberate choice, so
        // only a color literal is overwritten; the rest are reported to be changed by hand
        const overwritable = literal && /^#[0-9a-f]{3,8}$/i.test(literal.value);
        if ((fallback.length && !literal) || (literal && literal.value.toLowerCase() === value)) {
          return;
        }
        if (canFix && (!literal || overwritable)) {
          if (literal) {
            literal.value = value;
          } else {
            valueNode.nodes.push(
              { type: 'div', value: ',', before: '', after: ' ' },
              { type: 'word', value },
            );
          }
          rewritten = true;
          return;
        }
        stylelint.utils.report({
          result,
          ruleName,
          message: literal ? messages.mismatch : messages.expected,
          messageArgs: literal ? [nameNode.value, literal.value, value] : [nameNode.value, value],
          node,
          index: valueIndex + nameNode.sourceIndex,
          endIndex: valueIndex + nameNode.sourceEndIndex,
        });
      });
      if (rewritten) {
        node[property] = parsed.toString();
      }
    };

    root.walkDecls(decl => handleMissingFallbacks(decl, 'value', declarationValueIndex(decl)));
    root.walkAtRules(atRule => handleMissingFallbacks(atRule, 'params', atRuleParamsIndex(atRule)));
  };
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

module.exports = stylelint.createPlugin(ruleName, rule);

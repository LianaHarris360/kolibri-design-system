import stylelint from 'stylelint';
import plugin from '../require-theme-var-fallback';
import { getThemeCssVariableValues } from '../../themeCssVariableNames';

const { ruleName, messages } = plugin.rule;

function themeValue(name) {
  return getThemeCssVariableValues().get(name).toLowerCase();
}

const SURFACE = themeValue('--tokens-surface');
const FINE_LINE = themeValue('--tokens-fineLine');
const BRAND_PRIMARY = themeValue('--brand-primary-v600');
const GREY = themeValue('--palette-grey-v400');
// a color the theme does not emit for any variable
const WRONG = '#123456';

function lintScss(code, fix = false) {
  return stylelint.lint({
    code,
    codeFilename: 'test.scss',
    customSyntax: 'postcss-scss',
    config: {
      plugins: [plugin],
      rules: { [ruleName]: true },
    },
    fix,
  });
}

async function warningsFor(code) {
  const { results } = await lintScss(code);
  return results[0].warnings.filter(warning => warning.rule === ruleName);
}

async function fixed(code) {
  const { output } = await lintScss(code, true);
  return output;
}

describe('require-theme-var-fallback', () => {
  it('reports a theme `var()` with no fallback, pointing at the name', async () => {
    const code = '.a { color: var(--tokens-surface); }';
    const warnings = await warningsFor(code);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toBe(messages.expected('--tokens-surface', SURFACE));
    expect(code.slice(warnings[0].column - 1, warnings[0].endColumn - 1)).toBe('--tokens-surface');
  });

  it('adds the value the theme emits, for every prefix', async () => {
    expect(await fixed('.a { color: var(--tokens-surface); }')).toBe(
      `.a { color: var(--tokens-surface, ${SURFACE}); }`,
    );
    expect(await fixed('.a { border-color: var(--brand-primary-v600); }')).toBe(
      `.a { border-color: var(--brand-primary-v600, ${BRAND_PRIMARY}); }`,
    );
    expect(await fixed('.a { background: var(--palette-grey-v400); }')).toBe(
      `.a { background: var(--palette-grey-v400, ${GREY}); }`,
    );
  });

  it('adds it inside another function, an at-rule, and a nested fallback', async () => {
    expect(await fixed('.a { background: linear-gradient(var(--tokens-surface), red); }')).toBe(
      `.a { background: linear-gradient(var(--tokens-surface, ${SURFACE}), red); }`,
    );
    expect(await fixed('.a { @include shadow(var(--tokens-fineLine)); }')).toBe(
      `.a { @include shadow(var(--tokens-fineLine, ${FINE_LINE})); }`,
    );
    expect(await fixed('.a { color: var(--tokens-primary, var(--tokens-surface)); }')).toBe(
      `.a { color: var(--tokens-primary, var(--tokens-surface, ${SURFACE})); }`,
    );
  });

  it('reports and corrects a fallback that is not the value the theme emits', async () => {
    const code = `.a { color: var(--tokens-surface, ${WRONG}); }`;
    const warnings = await warningsFor(code);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toBe(messages.mismatch('--tokens-surface', WRONG, SURFACE));
    expect(await fixed(code)).toBe(`.a { color: var(--tokens-surface, ${SURFACE}); }`);
  });

  it('leaves a correct fallback alone, whatever case it is written in', async () => {
    for (const value of [SURFACE, SURFACE.toUpperCase()]) {
      const code = `.a { color: var(--tokens-surface, ${value}); }`;
      expect(await warningsFor(code)).toHaveLength(0);
      expect(await fixed(code)).toBe(code);
    }
  });

  it('leaves a fallback that is not a single literal alone', async () => {
    // a deliberate `var()` chain, or a multi-part value
    for (const code of [
      `.a { color: var(--tokens-primary, var(--tokens-surface, ${SURFACE})); }`,
      '.a { color: var(--tokens-surface, 0 0 red); }',
    ]) {
      expect(await warningsFor(code)).toHaveLength(0);
      expect(await fixed(code)).toBe(code);
    }
  });

  it('resolves a source `v_N` name, so it does not depend on rule order', async () => {
    // `kds/no-unknown-theme-custom-properties` corrects the name to `vN`, and may
    // not have run yet
    expect(await fixed('.a { background: var(--palette-grey-v_400); }')).toBe(
      `.a { background: var(--palette-grey-v_400, ${GREY}); }`,
    );
  });

  it('points at the name for an at-rule too', async () => {
    const code = '.a { @include shadow(var(--tokens-surface)); }';
    const warnings = await warningsFor(code);
    expect(warnings).toHaveLength(1);
    expect(code.slice(warnings[0].column - 1, warnings[0].endColumn - 1)).toBe('--tokens-surface');
  });

  it('leaves a name the theme does not emit alone', async () => {
    // a component's own property, and one an app adds with `setTokenMapping()`
    for (const code of [
      '.a { color: var(--someLocalProperty); }',
      '.a { color: var(--tokens-appDefined); }',
    ]) {
      expect(await warningsFor(code)).toHaveLength(0);
      expect(await fixed(code)).toBe(code);
    }
  });
});

/*
 * The naming rules for the theme CSS variables, shared by the runtime that
 * emits them and the lint rules that check them. It is CommonJS so the lint
 * rules, which run in plain Node, can require it.
 */

// the theme accessor each variable prefix corresponds to
const THEME_ACCESSOR_PREFIXES = {
  themeTokens: 'tokens',
  themeBrand: 'brand',
  themePalette: 'palette',
};

const THEME_VARIABLE_PREFIXES = Object.values(THEME_ACCESSOR_PREFIXES).map(
  prefix => `--${prefix}-`,
);

/** Version keys are emitted as `vN`, so `v_400` becomes `v400`. */
function formatPathSegment(key) {
  return key.replace(/^v_(\d+)$/, 'v$1');
}

/** The variable name for a path of object keys, e.g. `--palette-grey-v400`. */
function themeCssVariableName(prefix, segments) {
  // a caller may pass either `palette` or `--palette`
  const accessor = prefix.replace(/^-+/, '');
  return [`--${accessor}`, ...segments.map(formatPathSegment)].join('-');
}

/**
 * Every `[name, value]` pair of a color or token tree, where a string is a leaf
 * and any other non-object value is skipped.
 */
function flattenThemeTree(prefix, tree) {
  const entries = [];
  const walk = (segments, value) => {
    if (typeof value === 'string') {
      entries.push([themeCssVariableName(prefix, segments), value]);
    } else if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        walk([...segments, key], value[key]);
      }
    }
  };
  walk([], tree);
  return entries;
}

module.exports = {
  THEME_ACCESSOR_PREFIXES,
  THEME_VARIABLE_PREFIXES,
  formatPathSegment,
  themeCssVariableName,
  flattenThemeTree,
};

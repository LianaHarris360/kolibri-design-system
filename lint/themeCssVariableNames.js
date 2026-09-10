/*
 * Derives the set of valid theme CSS variable names (`--tokens-*`, `--brand-*`,
 * and `--palette-*`) from the same source files the runtime theme is built from,
 * so lint rules stay in sync when tokens, brand colors, or palette colors are added.
 */

// these are ES modules, loaded through Node's `require(esm)` support
const materialColors = require('../lib/styles/colorsMaterial').default;
const { defaultBrandColors, defaultTokenMapping } = require('../lib/styles/colorsDefault');
const {
  THEME_VARIABLE_PREFIXES,
  flattenThemeTree,
  formatPathSegment,
} = require('../lib/styles/cssVariableNaming');

let cachedNames = null;

/**
 * Returns a `Set` of every valid theme CSS variable name.
 */
function getThemeCssVariableNames() {
  if (cachedNames) {
    return cachedNames;
  }
  const names = [
    ...flattenThemeTree('palette', materialColors),
    ...flattenThemeTree('brand', defaultBrandColors),
    ...flattenThemeTree('tokens', defaultTokenMapping),
  ].map(([name]) => name);
  if (!names.length) {
    throw new Error('No theme CSS variable names were found in the theme source files');
  }
  cachedNames = new Set(names);
  return cachedNames;
}

function isThemedCustomProperty(name) {
  return THEME_VARIABLE_PREFIXES.some(prefix => name.startsWith(prefix));
}

/**
 * Returns the valid name an invalid one was probably meant to be, or `null`.
 */
function suggestThemeCssVariableName(name) {
  const normalized = name.split('-').map(formatPathSegment).join('-');
  if (normalized !== name && getThemeCssVariableNames().has(normalized)) {
    return normalized;
  }
  return null;
}

module.exports = {
  getThemeCssVariableNames,
  isThemedCustomProperty,
  suggestThemeCssVariableName,
};

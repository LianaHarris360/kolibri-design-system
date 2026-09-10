// Shared helpers for the theming lint rules

const {
  THEME_VARIABLE_PREFIXES,
  flattenThemeTree,
  formatPathSegment,
} = require('../lib/styles/cssVariableNamingRules');

// only a success is cached, a read that fails once is retried
let cachedNames = null;
let cachedValues = null;

/*
 * Read on demand, so that a failure to read them degrades the accessors below
 * instead of failing to load the rules. These are ES modules, loaded through
 * Node's `require(esm)` support.
 */
function readSources() {
  const materialColors = require('../lib/styles/colorsMaterial').default;
  const { defaultBrandColors, defaultTokenMapping } = require('../lib/styles/colorsDefault');
  return {
    materialColors,
    defaultBrandColors,
    defaultTokenMapping,
    // the tree `tokenMapping` paths are resolved against, as `theme.js` resolves them
    colors: { palette: materialColors, brand: defaultBrandColors },
  };
}

/**
 * The color a `tokenMapping` entry points at, or `null` when it does not resolve.
 * Mirrors `generateTokenToColorMapping` in `lib/styles/theme.js`, which walks the
 * same dot path and treats a value without one as a literal color.
 */
function resolveToken(mapString, colors) {
  if (!mapString.includes('.')) {
    return mapString;
  }
  let value = colors;
  for (const key of mapString.split('.')) {
    if (!value[key]) {
      return null;
    }
    value = value[key];
  }
  return typeof value === 'string' ? value : null;
}

/**
 * Returns a `Set` of every valid theme CSS variable name.
 */
function getThemeCssVariableNames() {
  if (cachedNames) {
    return cachedNames;
  }
  try {
    cachedNames = readNames();
  } catch (error) {
    return null;
  }
  return cachedNames;
}

function readNames() {
  const { materialColors, defaultBrandColors, defaultTokenMapping } = readSources();
  const names = [
    ...flattenThemeTree('palette', materialColors),
    ...flattenThemeTree('brand', defaultBrandColors),
    ...flattenThemeTree('tokens', defaultTokenMapping),
  ].map(([name]) => name);
  if (!names.length) {
    throw new Error('No theme CSS variable names were found in the theme source files');
  }
  return new Set(names);
}

/**
 * Returns a `Map` of every theme CSS variable name to the color it is emitted with,
 * for the literal fallback a `var()` in this repository needs.
 */
function getThemeCssVariableValues() {
  if (cachedValues) {
    return cachedValues;
  }
  try {
    cachedValues = readValues();
  } catch (error) {
    return null;
  }
  return cachedValues;
}

function readValues() {
  const { materialColors, defaultBrandColors, defaultTokenMapping, colors } = readSources();
  const values = new Map([
    ...flattenThemeTree('palette', materialColors),
    ...flattenThemeTree('brand', defaultBrandColors),
  ]);
  for (const [name, mapString] of flattenThemeTree('tokens', defaultTokenMapping)) {
    const value = resolveToken(mapString, colors);
    if (value) {
      values.set(name, value);
    }
  }
  return values;
}

function isThemedCustomProperty(name) {
  return THEME_VARIABLE_PREFIXES.some(prefix => name.startsWith(prefix));
}

/**
 * Returns the valid name an invalid one was probably meant to be, or `null`.
 */
function suggestThemeCssVariableName(name) {
  const names = getThemeCssVariableNames();
  const normalized = name.split('-').map(formatPathSegment).join('-');
  if (names && normalized !== name && names.has(normalized)) {
    return normalized;
  }
  return null;
}

/**
 * Index of a declaration's value within the declaration's own source, so a report
 * can point at the offending name rather than the whole declaration.
 */
function declarationValueIndex(decl) {
  const raws = decl.raws;
  const between = (raws.between !== undefined ? raws.between : ':').length;
  const prefix = (raws.prop && raws.prop.prefix ? raws.prop.prefix : '').length;
  return decl.prop.length + prefix + between;
}

/** The same, for an at-rule's params, which follow `@`, the name, and any space. */
function atRuleParamsIndex(atRule) {
  const afterName = atRule.raws.afterName !== undefined ? atRule.raws.afterName : ' ';
  return 1 + atRule.name.length + afterName.length;
}

module.exports = {
  atRuleParamsIndex,
  declarationValueIndex,
  getThemeCssVariableNames,
  getThemeCssVariableValues,
  isThemedCustomProperty,
  suggestThemeCssVariableName,
};

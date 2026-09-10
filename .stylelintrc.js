const stylelintConfig = require('kolibri-format/.stylelintrc');

const noUnknownThemeCustomProperties = require('./lint/stylelint/no-unknown-theme-custom-properties');
const requireThemeVarFallback = require('./lint/stylelint/require-theme-var-fallback');

stylelintConfig['plugins'] = [
  ...(stylelintConfig['plugins'] || []),
  noUnknownThemeCustomProperties,
  requireThemeVarFallback,
];

stylelintConfig['rules']['selector-pseudo-element-no-unknown'] = [true, { ignorePseudoElements: ['v-deep'] }];

stylelintConfig['rules']['custom-property-pattern'] = ['^([a-z][a-zA-Z0-9]*)(-[a-zA-Z0-9]+)*$'];

// Catches misspelled theme CSS variables
stylelintConfig['rules']['kds/no-unknown-theme-custom-properties'] = true;

// Only the styles shipped in `lib` can be applied before the theme variables areemitted
stylelintConfig['overrides'] = [
  ...(stylelintConfig['overrides'] || []),
  {
    files: ['lib/**/*.vue', 'lib/**/*.scss', 'lib/**/*.css'],
    rules: { 'kds/require-theme-var-fallback': true },
  },
];

module.exports = stylelintConfig;

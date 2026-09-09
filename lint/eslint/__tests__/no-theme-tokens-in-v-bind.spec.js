import v8 from 'node:v8';

import { RuleTester } from 'eslint';
import * as vueParser from 'vue-eslint-parser';

import rule from '../rules/no-theme-tokens-in-v-bind';

// `RuleTester` normalizes rule options with `structuredClone`, which the jsdom
// test environment does not provide
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = value => v8.deserialize(v8.serialize(value));
}

const ruleTester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

/** A single file component whose one style rule contains `declaration`. */
function sfc(declaration) {
  return `<template><div class="a" /></template>
<style lang="scss" scoped>
  .a { ${declaration} }
</style>
`;
}

/** An invalid case that the rule rewrites, given the two declaration halves. */
function fixes(declaration, fixed) {
  return {
    filename: 'Invalid.vue',
    code: sfc(declaration),
    output: sfc(fixed),
    errors: [{ messageId: 'unexpectedTheme' }],
  };
}

ruleTester.run('no-theme-tokens-in-v-bind', rule, {
  valid: [
    {
      filename: 'Valid.vue',
      code: sfc('color: var(--tokens-primary);'),
    },
    {
      // a member that reads the theme cannot be rewritten, so it is not matched
      filename: 'Valid.vue',
      code: `<template><div class="a" /></template>
<script>
  export default {
    computed: {
      surfaceColor() {
        return this.$themeTokens.surface;
      },
    },
  };
</script>
<style lang="scss" scoped>
  .a { background: v-bind(surfaceColor); }
</style>
`,
    },
    {
      // outside a style block the theme is read normally
      filename: 'Valid.vue',
      code: `<script>
  import { themeTokens } from '../styles/theme';
  export default {
    computed: {
      color() {
        return themeTokens().primary;
      },
    },
  };
</script>
`,
    },
    {
      // a property that only shares a theme property's name
      filename: 'Valid.vue',
      code: sfc("color: v-bind('styles.$themeTokens');"),
    },
    {
      filename: 'Valid.vue',
      code: '<template><div class="a" /></template>',
    },
  ],
  invalid: [
    fixes('color: v-bind("themeTokens().primary");', 'color: var(--tokens-primary);'),
    fixes("background: v-bind('$themeTokens.surface');", 'background: var(--tokens-surface);'),
    fixes("background: v-bind('this.$themeTokens.surface');", 'background: var(--tokens-surface);'),
    fixes("color: v-bind('$themePalette.grey.v_400');", 'color: var(--palette-grey-v400);'),
    fixes(
      "border-color: v-bind('$themeBrand.primary.v_600');",
      'border-color: var(--brand-primary-v600);',
    ),
    {
      // two in one declaration are fixed in a single pass
      filename: 'Invalid.vue',
      code: sfc(
        "background: linear-gradient(v-bind('$themeTokens.surface'), v-bind('$themeTokens.fineLine'));",
      ),
      output: sfc('background: linear-gradient(var(--tokens-surface), var(--tokens-fineLine));'),
      errors: [{ messageId: 'unexpectedTheme' }, { messageId: 'unexpectedTheme' }],
    },
    fixes(
      "background: linear-gradient(to right, v-bind('$themeTokens.fineLine'), transparent);",
      'background: linear-gradient(to right, var(--tokens-fineLine), transparent);',
    ),
    {
      // plain CSS style blocks are checked too
      filename: 'Invalid.vue',
      code: `<template><div class="a" /></template>
<style scoped>
  .a { color: v-bind("themeTokens().text"); }
</style>
`,
      output: `<template><div class="a" /></template>
<style scoped>
  .a { color: var(--tokens-text); }
</style>
`,
      errors: [{ messageId: 'unexpectedTheme' }],
    },
    {
      // nested at any depth, which is where KTable had it
      filename: 'Invalid.vue',
      code: `<template><div class="a" /></template>
<style lang="scss" scoped>
  @mixin shadow($direction) {
    &::before { background: v-bind('$themeTokens.surface'); }
  }
</style>
`,
      output: `<template><div class="a" /></template>
<style lang="scss" scoped>
  @mixin shadow($direction) {
    &::before { background: var(--tokens-surface); }
  }
</style>
`,
      errors: [{ messageId: 'unexpectedTheme' }],
    },
    {
      // every occurrence across every style block
      filename: 'Invalid.vue',
      code: `<template><div class="a" /></template>
<style lang="scss" scoped>
  .a { color: v-bind("themeTokens().primary"); }
</style>
<style lang="scss">
  .b { color: v-bind("themeTokens().text"); }
</style>
`,
      output: `<template><div class="a" /></template>
<style lang="scss" scoped>
  .a { color: var(--tokens-primary); }
</style>
<style lang="scss">
  .b { color: var(--tokens-text); }
</style>
`,
      errors: [{ messageId: 'unexpectedTheme' }, { messageId: 'unexpectedTheme' }],
    },
    {
      // a compound expression is reported, but has no mechanical rewrite
      filename: 'Invalid.vue',
      code: sfc('color: v-bind("isActive ? themeTokens().primary : \'red\'");'),
      output: null,
      errors: [{ messageId: 'unexpectedTheme' }],
    },
    {
      // a namespaced call may be any object's method, so it is not rewritten
      filename: 'Invalid.vue',
      code: sfc('color: v-bind("theme.themeTokens().primary");'),
      output: null,
      errors: [{ messageId: 'unexpectedTheme' }],
    },
    {
      filename: 'Invalid.vue',
      code: sfc("color: v-bind('myStuff.themePalette().red');"),
      output: null,
      errors: [{ messageId: 'unexpectedTheme' }],
    },
    {
      // a path that does not name a variable the theme emits is not rewritten
      filename: 'Invalid.vue',
      code: sfc("color: v-bind('$themeTokens.surfase');"),
      output: null,
      errors: [{ messageId: 'unexpectedTheme' }],
    },
    {
      filename: 'Invalid.vue',
      code: sfc("color: v-bind('$themeTokens.surface || fallback');"),
      output: null,
      errors: [{ messageId: 'unexpectedTheme' }],
    },
  ],
});

// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['doc/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    }
  },
  {
    files: ['**/pages/**/*.vue', '**/layouts/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  }
)

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 'android' and 'ios' are the Capacitor native shells — generated Gradle/
  // Xcode project trees (plus their own build output, e.g. Capacitor's
  // bridge JS copied into android/app/build/.../assets on every native
  // build) that this config was never meant to lint as app source.
  globalIgnores(['dist', 'android', 'ios']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks 7 ships the React Compiler's rules inside
      // `recommended-latest`. This app does not use the compiler, and these
      // five flag patterns it relies on on purpose (a ref refreshed during
      // render to keep a callback stable, state synced from an effect) —
      // ~160 sites. Rewriting them would change behaviour for no benefit
      // without the compiler, so they stay off; the classic rules
      // (rules-of-hooks, exhaustive-deps) and the rest of the compiler set
      // stay on. Revisit if the React Compiler is ever adopted.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
    },
  },
])

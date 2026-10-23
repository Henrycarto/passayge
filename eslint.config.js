import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist', '**/test-results', '**/playwright-report', 'docs/design/mockups', '**/coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright fixtures: `use` is Playwright's, not a React hook, and `{}` is its required signature.
    files: ['apps/web/e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off', 'no-empty-pattern': 'off' },
  },
);

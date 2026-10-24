import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    rules: {
      // security.md section 4.3: no dynamic code execution.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Every SQL value is a bound parameter; string concatenation into a query is never acceptable.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='query'] > BinaryExpression[operator='+']",
          message: 'Build SQL with bound parameters ($1, $2, ...), not string concatenation.',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Bracket access here is on typed, allow-listed maps, which this rule cannot tell apart from user input.
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
  prettier,
);

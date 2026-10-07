// @ts-check
import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const WEB = 'apps/web/**/*.{ts,tsx}';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/next-env.d.ts',
      // Código de terceros copiado en el build (worker de MapLibre).
      'apps/web/public/vendor/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Los módulos de NestJS son clases vacías decoradas con @Module.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  // Web (Next.js + React)
  { files: [WEB], ...eslintReact.configs['recommended-type-checked'] },
  { files: [WEB], ...reactHooks.configs.flat['recommended-latest'] },
  { files: [WEB], ...nextPlugin.configs['core-web-vitals'] },
  {
    files: [WEB],
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: `${import.meta.dirname}/apps/web` } },
  },
  {
    files: ['**/*.mjs', '**/*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);

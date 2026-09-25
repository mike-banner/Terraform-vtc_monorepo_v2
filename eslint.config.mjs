import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

// Lint « correctness only » : on cherche le code mort, les identifiants inexistants
// et les erreurs franches, pas le style. Le formatage n'est pas arbitré ici.
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/.wrangler/**',
      '.kilo/**',
      'apps/superadmin/**', // a déjà sa propre config ESLint
      'supabase/functions/**', // Deno, résolution d'imports par URL
      // Le parser Astro bute sur ces deux fichiers (CSS inline dans setup, `}` en
      // texte JSX dans rate/[id]). Limitation de l'outil, pas du code.
      'apps/vtc-backoffice/src/pages/app/setup.astro',
      'apps/vtc-backoffice/src/pages/rate/**', // glob : les crochets du nom sont des classes de caractères
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    // Scripts de build/CI : Node, pas navigateur — `console` et `process` existent.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    rules: {
      // Le code existant utilise `any` massivement sur les retours Supabase.
      // À resserrer quand les types générés seront branchés partout.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      // Espace insécable avant « € » et « : » : typographie française correcte.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipJSXText: true }],
      // `catch {}` volontaire sur les effets cosmétiques.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-assignment': 'error',
    },
  },
];

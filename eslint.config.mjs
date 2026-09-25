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
      // Config Tailwind 3 morte : aucun import ne la charge (l'app est passée à
      // @tailwindcss/vite) et elle contient un require() illégal en ESM.
      // À supprimer — laissée en place le temps de confirmer qu'elle n'a pas d'usage hors repo.
      'apps/vtc-backoffice/tailwind.config.mjs',
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
    rules: {
      // Le code existant utilise `any` massivement sur les retours Supabase.
      // À resserrer quand les types générés seront branchés partout.
      '@typescript-eslint/no-explicit-any': 'off',
      // Dette existante (61 occurrences au 2026-09-24) : signalée, non bloquante.
      // Passer en 'error' une fois le stock résorbé.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      // Espace insécable avant « € » et « : » : typographie française correcte.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipJSXText: true }],
      // `catch {}` volontaire sur les effets cosmétiques.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Initialisations défensives existantes : signalées, non bloquantes.
      'no-useless-assignment': 'warn',
    },
  },
];

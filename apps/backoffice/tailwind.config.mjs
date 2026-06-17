/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdb,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6366f1',
          secondary: '#4f46e5',
          dark: '#050505',
        },
      },
      fontSize: {
        'fluid-xs': 'var(--text-xs)',
        'fluid-sm': 'var(--text-sm)',
        'fluid-base': 'var(--text-base)',
        'fluid-lg': 'var(--text-lg)',
        'fluid-xl': 'var(--text-xl)',
        'fluid-2xl': 'var(--text-2xl)',
        'fluid-3xl': 'var(--text-3xl)',
        'fluid-4xl': 'var(--text-4xl)',
        'fluid-5xl': 'var(--text-5xl)',
      },
    },
  },
  plugins: [require('@park-ui/tailwind-plugin')],
  parkUI: {
    accentColor: 'indigo',
    grayColor: 'slate',
  },
  darkMode: 'class',
};

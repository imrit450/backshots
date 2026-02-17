/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Brand palette from Backshots Brand Identity v1 ────────── */
        pine: {
          50: '#e6f0ec',
          100: '#c0d9d0',
          200: '#96bfb1',
          300: '#6ba592',
          400: '#4d917b',
          500: '#2e7d64',
          600: '#1a5c47',
          700: '#0F3D2E',
          800: '#0A2A20', // Ancient Pine — primary
          900: '#061A14',
          950: '#030D0A',
        },
        gold: {
          50: '#faf8f3',
          100: '#f2ede2',
          200: '#e8dfc9',
          300: '#D6C5A4', // Champagne Gold — accent
          400: '#c7b08a',
          500: '#b59a70',
          600: '#a38558',
          700: '#8a6e47',
          800: '#705839',
          900: '#5a462e',
          950: '#3d2f1e',
        },
        ivory: '#F5F3EB',    // Ivory Mist — light neutral
        charcoal: '#121212', // Midnight Charcoal — dark neutral

        /* Keep brand alias pointing to pine for backward compat */
        brand: {
          50: '#e6f0ec',
          100: '#c0d9d0',
          200: '#96bfb1',
          300: '#6ba592',
          400: '#4d917b',
          500: '#2e7d64',
          600: '#1a5c47',
          700: '#0F3D2E',
          800: '#0A2A20',
          900: '#061A14',
          950: '#030D0A',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

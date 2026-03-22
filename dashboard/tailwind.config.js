/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vine: {
          50: '#f4f1ea',
          100: '#e8e3d6',
          200: '#d4cdb8',
          300: '#b5ab8e',
          400: '#968a6a',
          500: '#6b7a3d',
          600: '#4a5a28',
          700: '#3a4820',
          800: '#2a3518',
          900: '#18211b',
        },
        accent: '#0f7b6c',
      },
    },
  },
  plugins: [],
};

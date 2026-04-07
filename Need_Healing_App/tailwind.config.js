/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          medical: {
            light: '#0d9488',
            dark: '#06b6d4',
          },
          darkbg: '#0f172a',
        }
      },
    },
    plugins: [],
  }
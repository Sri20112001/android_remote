/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#07090E',
          900: '#0B0E14',
          850: '#10141D',
          800: '#151B26',
          700: '#1E2538',
          600: '#2A344C',
        },
        citrus: {
          DEFAULT: '#CAF300',
          hover: '#b5da00',
          muted: 'rgba(202, 243, 0, 0.15)',
        },
        cyber: {
          cyan: '#38BDF8',
          crimson: '#EF4444',
          emerald: '#10B981',
          amber: '#F59E0B',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}

/**
 * Tailwind CSS configuration for NativeWind.
 *
 * The `theme.extend` values mirror `src/theme/tokens.ts` — that file stays
 * the source of truth for the StyleSheet-based components, and the two must
 * be kept in sync when the palette or type scale changes.
 *
 * Content paths must cover every file that contains `className` strings.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: '#101319',
        surface: '#171B23',
        'surface-high': '#1D222C',
        border: '#2E3542',
        'border-strong': '#3D4552',
        // Content
        text: '#E1E2EB',
        'text-dim': '#9AA3B5',
        'text-faint': '#7E8699',
        // Accents
        accent: '#CAF300',
        'accent-pressed': '#B3DA00',
        'on-accent': '#101319',
        danger: '#FF5C5C',
        'danger-pressed': '#E14E4E',
        warn: '#FFC53D',
      },
      fontFamily: {
        // Registered by `useFonts` in src/app/_layout.tsx.
        display: ['Syne_700Bold'],
        'display-heavy': ['Syne_800ExtraBold'],
        body: ['PlusJakartaSans_400Regular'],
        'body-medium': ['PlusJakartaSans_500Medium'],
        'body-strong': ['PlusJakartaSans_600SemiBold'],
        'body-bold': ['PlusJakartaSans_700Bold'],
        mono: ['JetBrainsMono_400Regular'],
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
      letterSpacing: {
        micro: '1.2px',
        brand: '1.6px',
      },
      minHeight: {
        touch: '48px',
      },
    },
  },
  plugins: [],
};

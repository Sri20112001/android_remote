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
        bg: '#11100F',
        surface: '#1C1916',
        'surface-high': '#292522',
        border: '#443A32',
        'border-strong': '#5B4B3D',
        // Content
        text: '#E9E1D7',
        'text-dim': '#A99B8C',
        'text-faint': '#81766B',
        // Accents
        accent: '#B78350',
        'accent-pressed': '#986C43',
        'on-accent': '#11100F',
        danger: '#E06455',
        'danger-pressed': '#C74F42',
        warn: '#D6B88C',
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

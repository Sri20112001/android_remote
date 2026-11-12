/**
 * Design tokens for Remote Deck.
 *
 * Palette and type direction follow the product mockups in
 * `design/` (dark OLED surfaces, lime accent, monospace micro-labels).
 * Components must reference these tokens instead of raw hex values so the
 * whole app stays themable and contrast stays audited in one place.
 */

/** Font family names as registered in `useFonts` (see `src/app/_layout.tsx`). */
export const FontFamily = {
  display: 'Syne_700Bold',
  displayHeavy: 'Syne_800ExtraBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodyStrong: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/**
 * Semantic colors. Contrast against `bg` (checked):
 * text 14:1, textDim 7:1, textFaint 4.8:1, accent 11:1, danger 7:1.
 */

export const Color = {
  // Backgrounds
  bg: '#11100F',
  surface: '#1C1916',
  surfaceHigh: '#292522',

  // Borders
  border: '#443A32',
  borderStrong: '#5B4B3D',

  // Text
  text: '#E9E1D7',
  textDim: '#A99B8C',
  textFaint: '#81766B',

  // Accent
  accent: '#B78350',
  accentPressed: '#986C43',
  onAccent: '#11100F',

  // Status
  danger: '#E06455',
  dangerPressed: '#C74F42',
  warn: '#D6B88C',

  // Overlays
  scrim: 'rgba(17, 16, 15, 0.84)',

  /** Translucent obsidian glass surface. */
  glass: 'rgba(28, 25, 22, 0.94)',

  /** Subtle metallic glass border. */
  hairline: 'rgba(214, 184, 140, 0.09)',

  /** Brighter bronze corner reticles. */
  hairlineStrong: 'rgba(214, 184, 140, 0.24)',
} as const;


/** 4/8dp spacing rhythm. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Minimum touch target (48dp per platform guidance). */
export const TouchTarget = 48;

export const Type = {
  display: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    lineHeight: 36,
    color: Color.text,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    lineHeight: 26,
    color: Color.text,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    color: Color.text,
  },
  bodyDim: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: Color.textDim,
  },
  /** Signature monospace micro-label: uppercase, letter-spaced. */
  label: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Color.textDim,
  },
  data: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Color.text,
  },
} as const;

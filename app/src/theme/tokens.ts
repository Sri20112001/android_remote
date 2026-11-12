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
  bg: '#0D0E10',
  surface: '#17191D',
  surfaceHigh: '#22252A',

  // Borders
  border: '#34383F',
  borderStrong: '#4A5059',

  // Text
  text: '#F0F1F3',
  textDim: '#A5A9B0',
  textFaint: '#747A84',

  // Accent
  accent: '#A8B4C4',
  accentPressed: '#8795A8',
  onAccent: '#0D0E10',

  // Status
  danger: '#E06464',
  dangerPressed: '#C74C4C',
  warn: '#E0BE78',

  // Overlays
  scrim: 'rgba(13, 14, 16, 0.84)',

  /** Translucent obsidian glass surface. */
  glass: 'rgba(23, 25, 29, 0.94)',

  /** Subtle metallic glass border. */
  hairline: 'rgba(190, 200, 215, 0.09)',

  /** Brighter silver corner reticles. */
  hairlineStrong: 'rgba(190, 200, 215, 0.24)',
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

/**
 * Shared geometry for the floating tab dock rendered by `(tabs)/_layout.tsx`.
 *
 * The dock is positioned `absolute bottom-0`, so it OVERLAYS whatever a tab
 * screen renders at its bottom edge. Every tab screen must reserve
 * `useTabBarClearance()` of bottom padding, otherwise its last component
 * (the trackpad's text input, a scroll screen's final card, …) is hidden
 * underneath the dock instead of sitting above it.
 *
 * Both the dock and the screens read this module, so the two can never
 * drift apart when the dock's height or the safe-area handling changes.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the dock itself: every tab item is `h-14` (56 dp). */
export const TAB_BAR_HEIGHT = 56;

/** Floor under the safe-area inset so the dock never hugs the screen edge. */
const TAB_BAR_MIN_BOTTOM_INSET = 12;

/** Breathing room kept between the dock and the content above it. */
export const TAB_BAR_GAP = 16;

/** Bottom padding applied to the dock itself (safe-area aware). */
export function tabBarBottomInset(insets: { bottom: number }): number {
  return Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_INSET);
}

/** Vertical space the dock occupies: items + their bottom padding. */
export function tabBarHeight(insets: { bottom: number }): number {
  return TAB_BAR_HEIGHT + tabBarBottomInset(insets);
}

/**
 * Bottom padding a tab screen must apply so its content stops above the
 * dock, with `TAB_BAR_GAP` of clearance.
 */
export function useTabBarClearance(): number {
  return tabBarHeight(useSafeAreaInsets()) + TAB_BAR_GAP;
}

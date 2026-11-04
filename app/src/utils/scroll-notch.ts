/**
 * Windows wheel delta: `MOUSEEVENTF_WHEEL` carries its distance in multiples
 * of WHEEL_DELTA (120). Applications integer-divide that value, so a partial
 * notch is silently discarded.
 */
export const WHEEL_DELTA = 120;

export interface WheelStep {
  /** Sub-notch travel left over for the next call. */
  remainder: number;
  /** Whole-notch delta to send right now, or 0 to stay quiet. */
  delta: number;
}

/**
 * Folds finger travel into whole wheel notches.
 *
 * Trackpad gestures produce many small deltas (a few units per touch event).
 * Sending those raw meant most applications scrolled nothing at all, so the
 * remainder is carried until it completes a full notch. Negative travel
 * (scrolling up) is handled symmetrically.
 */
export function takeWheelNotches(remainder: number, units: number): WheelStep {
  const total = remainder + units;
  const notches = Math.trunc(total / WHEEL_DELTA);
  if (notches === 0) {
    return { remainder: total, delta: 0 };
  }
  return {
    remainder: total - notches * WHEEL_DELTA,
    delta: notches * WHEEL_DELTA,
  };
}

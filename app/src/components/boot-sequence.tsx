/**
 * Boot sequence animation shown by the `index` route while the stored
 * session is being read.
 *
 * It is a *real* status display, not decoration: each checklist row maps to
 * a phase the app has actually completed by the time this renders.
 *
 *  - FONTS        the root layout only mounts children after `useFonts`
 *                 resolves, so this row is true whenever we are visible.
 *  - SECURE STORE `CredentialStore` is constructed by the root layout before
 *                 the navigator mounts.
 *  - SESSION      the only outstanding work, driven by the session status.
 *
 * Motion respects the OS "remove animations" preference: the pulse and the
 * sweep rail freeze into a static, still-legible frame.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Color, FontFamily, Radius, Spacing } from '@/theme/tokens';
import type { SessionStatus } from '@/auth/session';

type BootPhase = 'linking' | 'ready';

interface BootSequenceProps {
  /** Live session status: only `loading` keeps the boot screen up. */
  status: SessionStatus;
}

const RAIL_WIDTH = 176;
const RAIL_TRAVEL = RAIL_WIDTH - 56;

export function BootSequence({ status }: BootSequenceProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  // Render-stable animated values: memoized, never recreated per render.
  const pulse = useMemo(() => new Animated.Value(0), []);
  const sweep = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.5);
      sweep.setValue(0.5);
      return undefined;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    sweepLoop.start();

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [reduceMotion, pulse, sweep]);

  const phase: BootPhase = status === 'loading' ? 'linking' : 'ready';

  const markScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
  });

  const markOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });

  const railTranslate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [0, RAIL_TRAVEL],
  });

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Remote Deck starting. Session ${phase === 'linking' ? 'loading' : 'ready'}.`}
    >
      {/* Oversized, faint wordmark bleeding off the top-left corner. */}
      <Text style={styles.ghostWordmark} numberOfLines={1} allowFontScaling={false}>
        DECK
      </Text>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>SYSTEM INITIALIZING</Text>

        {/* Brand mark */}
        <View style={styles.markFrame}>
          <View style={styles.markCornerTL} />
          <View style={styles.markCornerBR} />
          <Animated.View
            style={[
              styles.markCore,
              { opacity: markOpacity, transform: [{ scale: markScale }] },
            ]}
          />
        </View>

        <Text style={styles.wordmark} allowFontScaling={false}>
          REMOTE DECK
        </Text>
        <Text style={styles.tagline}>WORKSTATION CONTROL CONSOLE</Text>

        {/* Indeterminate sweep rail: no fake percentage. */}
        <View style={styles.rail}>
          <Animated.View
            style={[styles.railFill, { transform: [{ translateX: railTranslate }] }]}
          />
        </View>

        {/* Live checklist */}
        <View style={styles.checklist}>
          <BootRow label="FONTS" state="ok" />
          <BootRow label="SECURE STORE" state="ok" />
          <BootRow
            label="SESSION"
            state={phase === 'linking' ? 'busy' : 'ok'}
            detail={phase === 'linking' ? 'LINKING' : 'READY'}
          />
        </View>
      </View>

      <Text style={styles.footer} allowFontScaling={false}>
        v0.1.0 // REMOTE DECK
      </Text>
    </View>
  );
}

function BootRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: 'ok' | 'busy';
  detail?: string;
}) {
  const text = detail ?? 'OK';

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowDots} />
      <Text style={[styles.rowValue, state === 'busy' ? styles.rowBusy : styles.rowOk]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    overflow: 'hidden',
  },
  ghostWordmark: {
    position: 'absolute',
    top: -Spacing.xxl,
    left: -Spacing.md,
    fontFamily: FontFamily.displayHeavy,
    fontSize: 220,
    lineHeight: 240,
    color: Color.surface,
  },
  content: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 3,
    color: Color.textFaint,
    marginBottom: Spacing.xl,
  },
  markFrame: {
    width: 76,
    height: 76,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderStrong,
    backgroundColor: Color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCornerTL: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: Color.accent,
  },
  markCornerBR: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: Color.accent,
  },
  markCore: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    backgroundColor: Color.accent,
  },
  wordmark: {
    marginTop: Spacing.xl,
    fontFamily: FontFamily.displayHeavy,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 4,
    color: Color.text,
  },
  tagline: {
    marginTop: Spacing.xs,
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 2.4,
    color: Color.textFaint,
  },
  rail: {
    marginTop: Spacing.xl,
    width: RAIL_WIDTH,
    height: 2,
    backgroundColor: Color.border,
    overflow: 'hidden',
  },
  railFill: {
    width: 56,
    height: 2,
    backgroundColor: Color.accent,
  },
  checklist: {
    marginTop: Spacing.xl,
    width: '100%',
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Color.textDim,
  },
  rowDots: {
    flex: 1,
    height: 1,
    backgroundColor: Color.border,
    opacity: 0.6,
  },
  rowValue: {
    fontFamily: FontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  rowOk: {
    color: Color.accent,
  },
  rowBusy: {
    color: Color.warn,
  },
  footer: {
    position: 'absolute',
    bottom: Spacing.xxl,
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Color.textFaint,
  },
});

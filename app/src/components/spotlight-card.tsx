/**
 * AETHER-style spotlight card.
 *
 * Ports the card language from the AETHER control-plane mockup to React
 * Native without pulling in SVG or gradient dependencies: the glass surface,
 * hairline border, corner reticles, top-edge highlight and the accent
 * spotlight are all composed from plain views.
 *
 * The web version tracks the cursor on hover. A phone has no hover state, so
 * the spotlight follows the finger and fades out when the press ends. The
 * falloff is faked with concentric translucent circles because React Native
 * has no `radial-gradient` primitive.
 */

import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Color, Radius, Spacing } from '@/theme/tokens';

/**
 * Stacked translucent circles approximate a radial gradient. Alpha is kept
 * low per ring so the combined centre stays near the web mockup's 0.14 glow.
 */
const GLOW_RINGS = [
  { size: 320, alpha: 0.012 },
  { size: 220, alpha: 0.016 },
  { size: 150, alpha: 0.02 },
  { size: 90, alpha: 0.026 },
  { size: 44, alpha: 0.034 },
] as const;

const BEAM_WIDTH = 96;

/** Accepts `#rgb` / `#rrggbb` and returns an `rgba()` string. */
function tint(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const int = Number.parseInt(expanded, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface SpotlightCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Draws the animated accent beam along the top edge. Reserve it for the one
   * card that needs attention — every additional beam is another loop.
   */
  featured?: boolean;
  /** Tint for the spotlight and illuminated ring. Defaults to the lime accent. */
  accent?: string;
  /** Inner padding. Defaults to 16. */
  padding?: number;
  /** Gap between direct children. Defaults to 16. */
  gap?: number;
  testID?: string;
}

export function SpotlightCard({
  children,
  style,
  featured = false,
  accent = Color.accent,
  padding = Spacing.lg,
  gap = Spacing.lg,
  testID,
}: SpotlightCardProps) {
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Memoized so the animated values survive re-renders.
  const glow = useMemo(() => new Animated.Value(0), []);
  const beam = useMemo(() => new Animated.Value(0), []);

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
    if (!featured || reduceMotion || width === 0) {
      beam.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(beam, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
      beam.setValue(0);
    };
  }, [beam, featured, reduceMotion, width]);

  const fadeGlow = (toValue: number) => {
    Animated.timing(glow, {
      toValue,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;

    cardRef.current?.measureInWindow((x, y) => {
      originRef.current = { x, y };
      setPoint({ x: pageX - x, y: pageY - y });
      fadeGlow(1);
    });
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const origin = originRef.current;
    if (origin === null) return;

    const { pageX, pageY } = event.nativeEvent;
    setPoint({ x: pageX - origin.x, y: pageY - origin.y });
  };

  const beamTranslate = beam.interpolate({
    inputRange: [0, 1],
    outputRange: [-BEAM_WIDTH, width],
  });

  return (
    <View
      ref={cardRef}
      testID={testID}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => fadeGlow(0)}
      onTouchCancel={() => fadeGlow(0)}
      style={[
        {
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Color.hairline,
          backgroundColor: Color.glass,
          shadowColor: '#000000',
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        },
        style,
      ]}>
      {/* Decoration layer: clipped so the glow and beam never leak. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: Radius.lg, overflow: 'hidden' },
        ]}>
        {/* Top edge highlight — three bands fake the horizontal fade. */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: Spacing.lg,
            right: Spacing.lg,
            height: 1,
            flexDirection: 'row',
          }}>
          <View style={{ flex: 1, backgroundColor: tint(Color.text, 0.02) }} />
          <View style={{ flex: 2, backgroundColor: tint(Color.text, 0.16) }} />
          <View style={{ flex: 1, backgroundColor: tint(Color.text, 0.02) }} />
        </View>

        {/* Touch-tracked spotlight. */}
        {point !== null && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: glow }]}>
            {GLOW_RINGS.map((ring) => (
              <View
                key={ring.size}
                style={{
                  position: 'absolute',
                  left: point.x - ring.size / 2,
                  top: point.y - ring.size / 2,
                  width: ring.size,
                  height: ring.size,
                  borderRadius: ring.size / 2,
                  backgroundColor: tint(accent, ring.alpha),
                }}
              />
            ))}
          </Animated.View>
        )}

        {/* Illuminated hairline ring. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: tint(accent, 0.35),
              opacity: glow,
            },
          ]}
        />

        {/* Featured beam: a light pulse travelling along the top edge. */}
        {featured && !reduceMotion && width > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: BEAM_WIDTH,
              height: 8,
              transform: [{ translateX: beamTranslate }],
            }}>
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 8,
                borderRadius: 4,
                backgroundColor: tint(accent, 0.16),
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                borderRadius: 1,
                backgroundColor: tint(accent, 0.9),
              }}
            />
          </Animated.View>
        )}
      </View>

      {/* Corner reticles. */}
      <View
        pointerEvents="none"
        style={[styles.reticle, { top: 8, left: 8, borderTopWidth: 1, borderLeftWidth: 1 }]}
      />
      <View
        pointerEvents="none"
        style={[styles.reticle, { top: 8, right: 8, borderTopWidth: 1, borderRightWidth: 1 }]}
      />
      <View
        pointerEvents="none"
        style={[styles.reticle, { bottom: 8, left: 8, borderBottomWidth: 1, borderLeftWidth: 1 }]}
      />
      <View
        pointerEvents="none"
        style={[styles.reticle, { bottom: 8, right: 8, borderBottomWidth: 1, borderRightWidth: 1 }]}
      />

      <View style={{ padding, gap }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  reticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: Color.hairlineStrong,
  },
});

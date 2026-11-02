import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface BatteryCellLoaderProps {
  percent?: number;
  isCharging?: boolean;
  color?: string;
}

export function BatteryCellLoader({
  percent = 50,
  isCharging = false,
  color = '#22f49e',
}: BatteryCellLoaderProps) {
  const [step, setStep] = useState<number>(0);
  const pulseAnim = useRef(new Animated.Value(0.7)).current;

  // 6-step charging animation loop matching the CSS steps(6)
  useEffect(() => {
    if (!isCharging) {
      setStep(Math.min(6, Math.max(0, Math.round((percent / 100) * 6))));
      return;
    }

    const interval = setInterval(() => {
      setStep((prev) => (prev >= 6 ? 0 : prev + 1));
    }, 320);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      clearInterval(interval);
      pulse.stop();
    };
  }, [isCharging, percent, pulseAnim]);

  const activeBars = isCharging
    ? step
    : Math.min(6, Math.max(0, Math.round((percent / 100) * 6)));

  return (
    <View style={styles.container}>
      {/* Battery Main Body Frame */}
      <View style={[styles.batteryFrame, { borderColor: color }]}>
        {/* Repeating 6 Charging Segments */}
        <View style={styles.segmentsRow}>
          {[1, 2, 3, 4, 5, 6].map((i) => {
            const isFilled = i <= activeBars;
            return (
              <View
                key={i}
                style={[
                  styles.segmentBar,
                  isFilled && { backgroundColor: color, opacity: 0.95 },
                ]}
              />
            );
          })}
        </View>

        {/* Lightning Charge Bolt in Center */}
        <Animated.View
          style={[
            styles.lightningWrapper,
            isCharging && { opacity: pulseAnim },
          ]}
        >
          <MaterialCommunityIcons
            name="lightning-bolt"
            size={28}
            color={isCharging ? '#0B0E14' : 'rgba(37, 37, 37, 0.78)'}
          />
        </Animated.View>
      </View>

      {/* Battery Positive Terminal Cap (Right Nipple) */}
      <View style={[styles.terminalCap, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  batteryFrame: {
    width: 90,
    height: 44,
    borderWidth: 2,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    borderRightWidth: 1,
    padding: 3,
    backgroundColor: '#070A0F',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  segmentsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  segmentBar: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(34, 244, 158, 0.08)',
  },
  lightningWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  terminalCap: {
    width: 6,
    height: 18,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginLeft: 1,
  },
});

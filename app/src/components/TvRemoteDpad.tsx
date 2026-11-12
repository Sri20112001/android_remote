
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerHaptic } from '@/utils/haptics';

interface TvRemoteDpadProps {
  onSendKey: (key: string) => void;
}

const C = {
  bg: '#11100F',
  surface: '#1C1916',
  surfaceHigh: '#292522',
  border: '#443A32',
  borderStrong: '#8A6546',
  bronze: '#B78350',
  champagne: '#D6B88C',
  text: '#E9E1D7',
  muted: '#81766B',
};

export function TvRemoteDpad({ onSendKey }: TvRemoteDpadProps) {
  const [upScale] = useState(() => new Animated.Value(1));
  const [downScale] = useState(() => new Animated.Value(1));
  const [leftScale] = useState(() => new Animated.Value(1));
  const [rightScale] = useState(() => new Animated.Value(1));
  const [okScale] = useState(() => new Animated.Value(1));

  const pressSpring = (
    anim: Animated.Value,
    action: () => void
  ) => {
    triggerHaptic.light();

    Animated.sequence([
      Animated.timing(anim, {
        toValue: 0.90,
        duration: 65,
        useNativeDriver: true,
      }),
      Animated.spring(anim, {
        toValue: 1,
        friction: 3,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();

    action();
  };

  const DirectionButton = ({
    direction,
    label,
    icon,
    scale,
    onPress,
  }: {
    direction: string;
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    scale: Animated.Value;
    onPress: () => void;
  }) => (
    <Animated.View
      style={{ transform: [{ scale }] }}
      className="w-[58px] h-[58px] items-center justify-center"
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${direction} navigation`}
        className="w-[54px] h-[54px] rounded-full items-center justify-center border"
        style={{
          backgroundColor: C.surfaceHigh,
          borderColor: C.borderStrong,
          elevation: 3,
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={27}
          color={C.champagne}
        />

        <Text
          className="text-[8px] font-bold tracking-widest"
          style={{ color: C.muted }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View className="items-center justify-center py-3">

      {/* OUTER METAL HOUSING */}
      <View
        className="w-[220px] h-[220px] rounded-full items-center justify-center relative border-2"
        style={{
          backgroundColor: C.surface,
          borderColor: C.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        }}
      >

        {/* INNER RING */}
        <View
          className="absolute inset-[7px] rounded-full border"
          style={{ borderColor: '#5B4B3D' }}
        />

        {/* TOP BUTTON */}
        <Animated.View
          className="absolute top-[7px] self-center"
          style={{ transform: [{ scale: upScale }] }}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() =>
              pressSpring(upScale, () => onSendKey('up'))
            }
            accessibilityRole="button"
            accessibilityLabel="Up"
            className="w-[54px] h-[54px] rounded-full items-center justify-center border"
            style={{
              backgroundColor: C.surfaceHigh,
              borderColor: C.borderStrong,
              elevation: 3,
            }}
          >
            <MaterialCommunityIcons
              name="chevron-up"
              size={28}
              color={C.champagne}
            />
            <Text
              className="text-[8px] font-bold tracking-widest"
              style={{ color: C.muted }}
            >
              UP
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* MIDDLE ROW */}
        <View className="flex-row items-center justify-between w-full px-1">

          {/* LEFT */}
          <DirectionButton
            direction="Left"
            label="LEFT"
            icon="chevron-left"
            scale={leftScale}
            onPress={() =>
              pressSpring(leftScale, () => onSendKey('left'))
            }
          />

          {/* CENTER OK */}
          <Animated.View
            style={{ transform: [{ scale: okScale }] }}
            className="w-[68px] h-[68px] items-center justify-center"
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                pressSpring(okScale, () => onSendKey('enter'))
              }
              accessibilityRole="button"
              accessibilityLabel="OK, select"
              className="w-[64px] h-[64px] rounded-full items-center justify-center border-2"
              style={{
                backgroundColor: '#443A32',
                borderColor: C.bronze,
                elevation: 6,
                shadowColor: C.bronze,
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
            >
              <Text
                className="text-base font-black tracking-widest"
                style={{ color: C.champagne }}
              >
                OK
              </Text>

              <View
                className="w-5 h-[1px] mt-1"
                style={{ backgroundColor: C.bronze }}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* RIGHT */}
          <DirectionButton
            direction="Right"
            label="RIGHT"
            icon="chevron-right"
            scale={rightScale}
            onPress={() =>
              pressSpring(rightScale, () => onSendKey('right'))
            }
          />

        </View>

        {/* BOTTOM BUTTON */}
        <Animated.View
          className="absolute bottom-[7px] self-center"
          style={{ transform: [{ scale: downScale }] }}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() =>
              pressSpring(downScale, () => onSendKey('down'))
            }
            accessibilityRole="button"
            accessibilityLabel="Down"
            className="w-[54px] h-[54px] rounded-full items-center justify-center border"
            style={{
              backgroundColor: C.surfaceHigh,
              borderColor: C.borderStrong,
              elevation: 3,
            }}
          >
            <Text
              className="text-[8px] font-bold tracking-widest"
              style={{ color: C.muted }}
            >
              DOWN
            </Text>

            <MaterialCommunityIcons
              name="chevron-down"
              size={28}
              color={C.champagne}
            />
          </TouchableOpacity>
        </Animated.View>

      </View>
    </View>
  );
}

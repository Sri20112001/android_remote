import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerHaptic } from '@/utils/haptics';

interface TvRemoteDpadProps {
  onSendKey: (key: string) => void;
}

export function TvRemoteDpad({ onSendKey }: TvRemoteDpadProps) {
  const [upScale] = useState(() => new Animated.Value(1));
  const [downScale] = useState(() => new Animated.Value(1));
  const [leftScale] = useState(() => new Animated.Value(1));
  const [rightScale] = useState(() => new Animated.Value(1));
  const [okScale] = useState(() => new Animated.Value(1));

  const pressSpring = (anim: Animated.Value, action: () => void) => {
    triggerHaptic.light();
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    action();
  };

  return (
    <View className="items-center justify-center py-2">
      <View className="w-[220px] h-[220px] bg-[#090C12] rounded-full border-2 border-[#1E2538] items-center justify-center relative shadow-lg">
        {/* UP BUTTON */}
        <Animated.View
          className="absolute top-1.5 self-center"
          style={{ transform: [{ scale: upScale }] }}
        >
          <TouchableOpacity
            className="w-[54px] h-[54px] bg-[#131924] rounded-full justify-center items-center border border-[#243048]"
            activeOpacity={0.7}
            onPress={() => pressSpring(upScale, () => onSendKey('up'))}
          >
            <MaterialCommunityIcons name="chevron-up" size={28} color="#CAF300" />
            <Text className="text-[#64748B] text-[8px] font-bold font-mono">UP</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* MIDDLE ROW */}
        <View className="flex-row items-center justify-between w-full px-1.5">
          {/* LEFT BUTTON */}
          <Animated.View
            className="w-[58px] h-[58px] justify-center items-center"
            style={{ transform: [{ scale: leftScale }] }}
          >
            <TouchableOpacity
              className="w-[54px] h-[54px] bg-[#131924] rounded-full justify-center items-center border border-[#243048]"
              activeOpacity={0.7}
              onPress={() => pressSpring(leftScale, () => onSendKey('left'))}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color="#CAF300" />
              <Text className="text-[#64748B] text-[8px] font-bold font-mono">LEFT</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* OK BUTTON */}
          <Animated.View
            className="w-[68px] h-[68px] justify-center items-center"
            style={{ transform: [{ scale: okScale }] }}
          >
            <TouchableOpacity
              className="w-16 h-16 rounded-full bg-[#1E293B] border-2 border-[#CAF300] justify-center items-center shadow-md"
              activeOpacity={0.75}
              onPress={() => pressSpring(okScale, () => onSendKey('enter'))}
            >
              <Text className="text-[#CAF300] text-base font-[900] font-mono">OK</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* RIGHT BUTTON */}
          <Animated.View
            className="w-[58px] h-[58px] justify-center items-center"
            style={{ transform: [{ scale: rightScale }] }}
          >
            <TouchableOpacity
              className="w-[54px] h-[54px] bg-[#131924] rounded-full justify-center items-center border border-[#243048]"
              activeOpacity={0.7}
              onPress={() => pressSpring(rightScale, () => onSendKey('right'))}
            >
              <MaterialCommunityIcons name="chevron-right" size={28} color="#CAF300" />
              <Text className="text-[#64748B] text-[8px] font-bold font-mono">RIGHT</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* DOWN BUTTON */}
        <Animated.View
          className="absolute bottom-1.5 self-center"
          style={{ transform: [{ scale: downScale }] }}
        >
          <TouchableOpacity
            className="w-[54px] h-[54px] bg-[#131924] rounded-full justify-center items-center border border-[#243048]"
            activeOpacity={0.7}
            onPress={() => pressSpring(downScale, () => onSendKey('down'))}
          >
            <Text className="text-[#64748B] text-[8px] font-bold font-mono">DOWN</Text>
            <MaterialCommunityIcons name="chevron-down" size={28} color="#CAF300" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
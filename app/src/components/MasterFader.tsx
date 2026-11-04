import React from 'react';
import { View, Text, Animated, GestureResponderHandlers } from 'react-native';

interface MasterFaderProps {
  volume: number;
  isDragging: boolean;
  panHandlers: GestureResponderHandlers;
}

export function MasterFader({ volume, isDragging, panHandlers }: MasterFaderProps) {
  // Clamp thumb offset within [0%, 88%]
  const thumbBottomPercent = Math.max(0, Math.min(88, volume * 0.88));

  return (
    <View className="flex-[1.25] bg-[#1E1E24] py-3 px-2.5 rounded-[14px] border border-[#151518] items-center shadow-lg">
      <View className="flex-row justify-between w-full items-center px-1 mb-2">
        <Text className="text-[#8E8E93] text-[11px] font-[800] tracking-wider font-mono">
          VOL 01
        </Text>
        <Text className="text-white text-[13px] font-[900] font-mono">
          {volume}%
        </Text>
      </View>

      <View
        className="relative h-[160px] w-20 flex-row justify-center items-center"
        {...panHandlers}
      >
        {/* Left Ticks */}
        <View className="h-[150px] justify-between py-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`tl_${i}`} className="w-2.5 h-[2px] bg-[#44444C] rounded-[1px]" />
          ))}
        </View>

        {/* Groove Track */}
        <View className="w-2 h-[150px] bg-[#0D0D10] rounded border border-[#151518] mx-2 overflow-hidden justify-end">
          <View
            className="w-full bg-[#CAF300] rounded"
            style={{ height: `${volume}%` }}
          />
        </View>

        {/* Right Ticks */}
        <View className="h-[150px] justify-between py-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`tr_${i}`} className="w-2.5 h-[2px] bg-[#44444C] rounded-[1px]" />
          ))}
        </View>

        {/* Fader Thumb */}
        <Animated.View
          className="absolute w-11 h-6 rounded-[3px] bg-[#3A3A42] border border-[#111114] flex-row items-center justify-center overflow-hidden shadow-md"
          style={{
            bottom: `${thumbBottomPercent}%`,
            transform: [{ scale: isDragging ? 1.06 : 1.0 }],
          }}
        >
          <View className="flex-1 h-full bg-[#555560]" />
          <View className="w-[3px] h-full bg-[#1A1A1F]" />
          <View className="w-[3px] h-full bg-[#D12B2B]" />
          <View className="w-[3px] h-full bg-[#1A1A1F]" />
          <View className="flex-1 h-full bg-[#555560]" />
        </Animated.View>
      </View>

      <Text className="text-[#64748B] text-[9px] font-mono mt-2">
        SLIDE TO ADJUST
      </Text>
    </View>
  );
}
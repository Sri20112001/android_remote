import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DualRockersProps {
  onSendKey: (key: string) => void;
}

export function DualRockers({ onSendKey }: DualRockersProps) {
  return (
    <View className="flex-row gap-2.5">
      {/* Volume Rocker */}
      <View className="flex-1 bg-[#090C12] rounded-[14px] p-2.5 border border-[#19202E] gap-2">
        <Text className="text-[#64748B] text-[9px] font-bold text-center font-mono">
          VOLUME
        </Text>
        <View className="bg-[#131924] rounded-xl border border-[#243048] overflow-hidden">
          <TouchableOpacity
            className="flex-row justify-center items-center py-2.5 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('volume_up')}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#CAF300" />
            <Text className="text-[#F1F5F9] text-[10px] font-bold font-mono">VOL +</Text>
          </TouchableOpacity>

          <View className="h-[1px] bg-[#1E2538]" />

          <TouchableOpacity
            className="flex-row justify-center items-center py-2.5 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('volume_down')}
          >
            <MaterialCommunityIcons name="minus" size={18} color="#CAF300" />
            <Text className="text-[#F1F5F9] text-[10px] font-bold font-mono">VOL -</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Page / Channel Rocker */}
      <View className="flex-1 bg-[#090C12] rounded-[14px] p-2.5 border border-[#19202E] gap-2">
        <Text className="text-[#64748B] text-[9px] font-bold text-center font-mono">
          SCROLL / PAGE
        </Text>
        <View className="bg-[#131924] rounded-xl border border-[#243048] overflow-hidden">
          <TouchableOpacity
            className="flex-row justify-center items-center py-2.5 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('pageup')}
          >
            <MaterialCommunityIcons name="chevron-double-up" size={18} color="#F1F5F9" />
            <Text className="text-[#F1F5F9] text-[10px] font-bold font-mono">PAGE UP</Text>
          </TouchableOpacity>

          <View className="h-[1px] bg-[#1E2538]" />

          <TouchableOpacity
            className="flex-row justify-center items-center py-2.5 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('pagedown')}
          >
            <MaterialCommunityIcons name="chevron-double-down" size={18} color="#F1F5F9" />
            <Text className="text-[#F1F5F9] text-[10px] font-bold font-mono">PAGE DN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
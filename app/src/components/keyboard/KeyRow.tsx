import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { KeySpec, KeyTone } from '@/types/types';
import { MODIFIER_KEYS } from '@/data/keyboardKeys';

export const TONE_STYLES: Record<KeyTone, { base: string; text: string }> = {
  default: {
    base: 'bg-[#12161F] border-zinc-800/90 active:bg-[#1B2330]',
    text: 'text-zinc-200',
  },
  accent: {
    base: 'bg-[#181E29] border-zinc-700/90 active:bg-[#232C3B]',
    text: 'text-zinc-300',
  },
  modifier: {
    base: 'bg-[#101724] border-[#CAF300]/30 active:bg-[#182031]',
    text: 'text-[#CAF300]',
  },
  primary: {
    base: 'bg-[#CAF300] border-[#CAF300] active:bg-[#B4D900]',
    text: 'text-black',
  },
  danger: {
    base: 'bg-[#1A1216] border-rose-500/40 active:bg-[#241820]',
    text: 'text-rose-300',
  },
};

export interface KeyRowProps {
  keys: KeySpec[];
  compact: boolean;
  armed: string[];
  onKeyPress: (key: string) => void;
}

export function KeyRow({ keys, compact, armed, onKeyPress }: KeyRowProps) {
  return (
    <View className="flex-1 flex-row gap-1">
      {keys.map((spec, index) => {
        const isModifier = MODIFIER_KEYS.has(spec.key);
        const isArmed = isModifier && armed.includes(spec.key);
        const tone = TONE_STYLES[spec.tone ?? 'default'];

        return (
          <TouchableOpacity
            key={`${spec.key}-${index}`}
            activeOpacity={0.65}
            onPress={() => onKeyPress(spec.key)}
            style={{ flexGrow: spec.grow ?? 1, flexBasis: 0 }}
            className={`h-full min-w-0 rounded-lg border items-center justify-center ${
              isArmed ? 'bg-[#CAF300] border-[#CAF300]' : tone.base
            }`}
          >
            <Text
              numberOfLines={1}
              className={`font-mono font-bold tracking-tight ${
                compact ? 'text-[10px]' : 'text-[12px]'
              } ${isArmed ? 'text-black' : tone.text}`}
            >
              {spec.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default KeyRow;

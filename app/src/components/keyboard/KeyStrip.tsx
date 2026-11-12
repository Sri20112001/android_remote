import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { KeySpec } from '@/types/types';
import { MODIFIER_KEYS } from '@/data/keyboardKeys';
import { TONE_STYLES } from './KeyRow';

export interface KeyStripProps {
  keys: KeySpec[];
  armed: string[];
  onKeyPress: (key: string) => void;
}

/** Horizontally scrolling row for the rare keys on narrow screens. */
export function KeyStrip({ keys, armed, onKeyPress }: KeyStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: 32, flexGrow: 0 }}
      contentContainerStyle={{ gap: 6, paddingRight: 6 }}
    >
      {keys.map((spec, index) => {
        const isArmed = MODIFIER_KEYS.has(spec.key) && armed.includes(spec.key);
        const tone = TONE_STYLES[spec.tone ?? 'default'];

        return (
          <TouchableOpacity
            key={`${spec.key}-${index}`}
            activeOpacity={0.65}
            onPress={() => onKeyPress(spec.key)}
            style={{ width: 46 }}
            className={`h-full rounded-md border items-center justify-center ${
              isArmed ? 'bg-[#CAF300] border-[#CAF300]' : tone.base
            }`}
          >
            <Text
              numberOfLines={1}
              className={`font-mono font-bold text-[9px] ${isArmed ? 'text-black' : tone.text}`}
            >
              {spec.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default KeyStrip;

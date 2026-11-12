import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ShortcutSpec } from '@/types/types';

export interface ProductivityRailProps {
  shortcuts: ShortcutSpec[];
  onTrigger: (shortcut: ShortcutSpec) => void;
}

/** Horizontal quick-action rail for common desktop productivity combos */
export function ProductivityRail({ shortcuts, onTrigger }: ProductivityRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: 34, flexGrow: 0 }}
      contentContainerStyle={{ gap: 6, paddingRight: 6 }}
    >
      {shortcuts.map((sc, index) => {
        const badgeColor = sc.color ?? '#CAF300';
        return (
          <TouchableOpacity
            key={`${sc.label}-${index}`}
            activeOpacity={0.7}
            onPress={() => onTrigger(sc)}
            className="h-full px-2.5 rounded-lg bg-[#0F141F] border border-zinc-800/90 flex-row items-center gap-1.5 active:bg-[#1A2333]"
          >
            {sc.icon && (
              <MaterialCommunityIcons name={sc.icon} size={13} color={badgeColor} />
            )}
            <Text
              numberOfLines={1}
              className="font-mono font-bold text-[10px] tracking-wider text-zinc-200"
            >
              {sc.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default ProductivityRail;

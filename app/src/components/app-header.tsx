/**
 * App header: minimal brand mark on the left, optional accessory
 * (status pill, back control) on the right.
 *
 * Dark console treatment: the mark is a lime glyph inside a raised surface
 * chip, and the wordmark uses the display face so the pairing flow reads as
 * the same product as the boot screen and the tab dock.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Color } from '@/theme/tokens';

export interface AppHeaderProps {
  /** Right-side accessory (pill, button…). */
  accessory?: ReactNode;
}

export function AppHeader({ accessory }: AppHeaderProps) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-4">
      <View className="flex-row items-center gap-3">
        {/* Brand mark */}
        <View className="h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-high">
          <MaterialCommunityIcons
            name="access-point"
            size={19}
            color={Color.accent}
          />
        </View>

        <Text className="font-display text-[15px] tracking-[2.4px] text-text">
          REMOTE DECK
        </Text>
      </View>

      {accessory}
    </View>
  );
}

/** 48dp icon button used for navigation. */
export function IconButton({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="h-12 min-w-12 items-center justify-center rounded-xl active:bg-surface-high"
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={Color.textDim}
      />
    </Pressable>
  );
}

/**
 * App header: minimal brand mark on the left, optional accessory
 * (status pill, back control) on the right.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export interface AppHeaderProps {
  /** Right-side accessory (pill, button…). */
  accessory?: ReactNode;
}

export function AppHeader({ accessory }: AppHeaderProps) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-4">
      <View className="flex-row items-center gap-3">
        {/* Native Cloud brand mark */}
        <View className="h-8 w-8 items-center justify-center rounded-xl bg-slate-800">
          <MaterialCommunityIcons
            name="cloud-outline"
            size={19}
            color="#FFFFFF"
          />
        </View>

        <Text className="text-base font-bold tracking-tight text-slate-900">
          Remote
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
      className="h-12 min-w-12 items-center justify-center rounded-xl active:bg-slate-100"
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color="#334155"
      />
    </Pressable>
  );
}
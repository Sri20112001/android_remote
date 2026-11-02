import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Color, FontFamily, Radius, Spacing, Type } from '@/theme/tokens';

export function MonoLabel({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      className="font-mono text-xs uppercase tracking-widest"
      style={[Type.label, style]}>
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      className="gap-4 rounded-xl border p-4"
      style={[
        {
          backgroundColor: Color.surface,
          borderColor: Color.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export interface DataRowProps {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
  wrap?: boolean;
}

export function DataRow({
  label,
  value,
  mono,
  valueColor,
  wrap,
}: DataRowProps) {
  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text
        className="shrink-0"
        style={Type.label}
        numberOfLines={1}>
        {label}
      </Text>

      <Text
        className="flex-1 text-right text-sm"
        style={[
          Type.data,
          mono && { fontFamily: FontFamily.monoMedium },
          valueColor ? { color: valueColor } : null,
        ]}
        numberOfLines={wrap ? undefined : 2}
        ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

export interface BannerProps {
  message: string;
  tone?: 'danger' | 'warn';
}

/** Inline error/status banner shown above the action that failed. */
export function Banner({ message, tone = 'danger' }: BannerProps) {
  const color = tone === 'danger' ? Color.danger : Color.warn;

  return (
    <View
      className="rounded-md border p-3"
      style={{
        borderColor: color,
        backgroundColor: Color.surface,
      }}
      accessibilityRole="alert">
      <Text
        className="text-center text-sm"
        style={{
          color,
          fontFamily: FontFamily.bodyMedium,
          fontSize: 14,
          lineHeight: 20,
        }}>
        {message}
      </Text>
    </View>
  );
}
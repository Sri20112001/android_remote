/**
 * Status pill: compact state indicator.
 * Tone is communicated through both color and text.
 *
 * Native Cloud design:
 * - Soft tinted status indicators
 * - Rounded pill shape
 * - Minimal status dot
 */

import { Text, View } from 'react-native';

export type PillTone = 'ok' | 'warn' | 'danger' | 'neutral';

export interface PillProps {
  label: string;
  tone?: PillTone;
}

const toneStyles: Record<
  PillTone,
  { container: string; dot: string; text: string }
> = {
  ok: {
    container: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  warn: {
    container: 'border-amber-200 bg-amber-50',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  danger: {
    container: 'border-red-200 bg-red-50',
    dot: 'bg-red-500',
    text: 'text-red-700',
  },
  neutral: {
    container: 'border-slate-200 bg-slate-50',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
  },
};

export function Pill({ label, tone = 'neutral' }: PillProps) {
  const styles = toneStyles[tone];

  return (
    <View
      className={`flex-row items-center self-start gap-2 rounded-full border px-3 py-1 ${styles.container}`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />

      <Text
        className={`text-[10px] font-bold uppercase tracking-wider ${styles.text}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

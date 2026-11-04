/**
 * Status pill: compact state indicator.
 * Tone is communicated through both color and text.
 *
 * Dark console design: tinted surface + matching hairline border, with the
 * label in the mono face so it lines up with every other micro-label.
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
    container: 'border-accent/40 bg-accent/10',
    dot: 'bg-accent',
    text: 'text-accent',
  },
  warn: {
    container: 'border-warn/40 bg-warn/10',
    dot: 'bg-warn',
    text: 'text-warn',
  },
  danger: {
    container: 'border-danger/40 bg-danger/10',
    dot: 'bg-danger',
    text: 'text-danger',
  },
  neutral: {
    container: 'border-border bg-surface',
    dot: 'bg-text-faint',
    text: 'text-text-dim',
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
        className={`font-mono-bold text-[9px] uppercase tracking-[1.4px] ${styles.text}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

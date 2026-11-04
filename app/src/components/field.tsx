/**
 * Labeled text field with inline error/hint.
 *
 * Dark console design:
 * - Always-visible mono micro-label
 * - Recessed input surface with a hairline border
 * - Lime caret so focus is visible without a light-mode outline
 * - Clear error and helper states
 * - 50dp minimum touch target
 */

import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { Color } from '@/theme/tokens';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  mono?: boolean;
}

export function Field({
  label,
  error,
  hint,
  mono,
  multiline,
  ...inputProps
}: FieldProps) {
  const hasError = error !== undefined && error !== null;

  return (
    <View className="gap-2">
      {/* Always-visible label */}
      <Text
        className="font-mono-medium text-[10px] uppercase tracking-[1.6px] text-text-dim"
        numberOfLines={1}
      >
        {label}
      </Text>

      {/* Input */}
      <TextInput
        className={`
          min-h-[50px]
          rounded-xl
          border
          bg-surface
          px-4
          py-3
          text-[15px]
          text-text
          ${mono ? 'font-mono text-base tracking-wide' : ''}
          ${multiline ? 'min-h-24 text-top' : ''}
          ${hasError ? 'border-danger' : 'border-border'}
        `}
        placeholderTextColor={Color.textFaint}
        selectionColor={Color.accent}
        accessibilityLabel={label}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...inputProps}
      />

      {/* Error or helper text */}
      {error ? (
        <Text
          className="text-[13px] leading-[18px] text-danger"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[13px] leading-[18px] text-text-faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

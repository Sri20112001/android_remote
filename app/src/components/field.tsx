/**
 * Labeled text field with inline error/hint.
 *
 * Native Cloud design:
 * - Always-visible labels
 * - Soft neutral input surfaces
 * - Subtle borders and rounded corners
 * - Clear error and helper states
 * - 50dp minimum touch target
 */

import { Text, TextInput, View, type TextInputProps } from 'react-native';

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
        className="text-sm font-semibold text-slate-700"
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
          bg-white
          px-4
          py-3
          text-[15px]
          text-slate-900
          ${mono ? 'font-mono text-base tracking-wide' : ''}
          ${multiline ? 'min-h-24 text-top' : ''}
          ${hasError ? 'border-red-400' : 'border-slate-200'}
        `}
        placeholderTextColor="#94A3B8"
        selectionColor="#64748B"
        accessibilityLabel={label}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...inputProps}
      />

      {/* Error or helper text */}
      {error ? (
        <Text
          className="text-[13px] leading-[18px] text-red-600"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[13px] leading-[18px] text-slate-500">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
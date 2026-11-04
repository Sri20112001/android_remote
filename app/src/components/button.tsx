/**
 * Button: the app's only tappable command control.
 *
 * Dark console design:
 * - 52dp minimum touch target
 * - Lime primary (the one "do the thing" colour in the palette)
 * - Ghost and danger variants stay on flat surfaces so a destructive action
 *   is outlined in danger red rather than filled with it
 * - Loading spinner and disabled states
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Color } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;

  const variants = {
    primary: {
      container: 'bg-accent active:bg-accent-pressed',
      text: 'text-on-accent',
      icon: Color.onAccent,
      spinner: Color.onAccent,
    },
    ghost: {
      container: 'border border-border bg-surface active:bg-surface-high',
      text: 'text-text',
      icon: Color.textDim,
      spinner: Color.textDim,
    },
    danger: {
      container: 'border border-danger bg-surface active:bg-surface-high',
      text: 'text-danger',
      icon: Color.danger,
      spinner: Color.danger,
    },
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        disabled: inactive,
        busy: loading,
      }}
      disabled={inactive}
      onPress={onPress}
      style={style}
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl px-6 py-3 ${
        variants.container
      } ${inactive ? 'opacity-50' : 'opacity-100'}`}
    >
      {loading ? (
        <ActivityIndicator
          color={variants.spinner}
          size="small"
        />
      ) : (
        <>
          {icon !== undefined && (
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={variants.icon}
            />
          )}

          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={`text-center font-mono-medium text-[12px] uppercase tracking-[1.6px] ${variants.text}`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

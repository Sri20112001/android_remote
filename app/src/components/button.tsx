/**
 * Button: the app's only tappable command control.
 *
 * Native Cloud design:
 * - 52dp minimum touch target
 * - Subtle pressed feedback
 * - Clearly differentiated button variants
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
      container: 'bg-slate-900 active:bg-slate-800',
      text: 'text-white',
      icon: '#FFFFFF',
      spinner: '#FFFFFF',
    },
    ghost: {
      container: 'border border-slate-200 bg-white active:bg-slate-100',
      text: 'text-slate-800',
      icon: '#334155',
      spinner: '#334155',
    },
    danger: {
      container: 'border border-red-200 bg-white active:bg-red-50',
      text: 'text-red-600',
      icon: '#DC2626',
      spinner: '#DC2626',
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
            className={`text-sm font-bold tracking-wide text-center ${variants.text}`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
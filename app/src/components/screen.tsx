/**
 * Screen shell: dark console background + safe-area handling.
 *
 * Content is centred and capped at `MAX_CONTENT_WIDTH` so layouts stay
 * readable on tablets and in landscape; phones simply use the full width.
 * `scroll` wraps content in a ScrollView tuned for forms (keyboard stays
 * out of the way of the focused field and taps are not swallowed).
 */

import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Readable measure for tablets and landscape phones. */
const MAX_CONTENT_WIDTH = 760;

export interface ScreenProps {
  children: ReactNode;
  /** Scrollable content (forms, long cards). */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = false, style }: ScreenProps) {
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  if (!scroll) {
    return (
      <SafeAreaView
        className="flex-1 bg-bg"
        edges={['top', 'bottom']}>
        <View className="flex-1 w-full items-center">
          <View
            className="flex-1 w-full gap-6 px-5 pt-4"
            style={[{ maxWidth: MAX_CONTENT_WIDTH }, style]}>
            {children}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-bg"
      edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}>
        <ScrollView
          contentContainerClassName="w-full self-center gap-6 px-5 pt-4 pb-10"
          contentContainerStyle={[{ maxWidth: MAX_CONTENT_WIDTH }, style]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onLayout={(event) =>
            setKeyboardOffset(event.nativeEvent.layout.y)
          }>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

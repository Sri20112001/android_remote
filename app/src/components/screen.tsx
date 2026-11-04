/**
 * Screen shell: dark console background + safe-area handling.
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
        <View
          className="flex-1 gap-6 px-5 pt-4"
          style={style}>
          {children}
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
          contentContainerClassName="gap-6 px-5 pt-4 pb-10"
          contentContainerStyle={style}
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
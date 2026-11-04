/**
 * Root layout: loads the brand fonts, mounts the session provider, and
 * declares the stack for the pairing flow.
 *
 * Visual direction: dark tactical console. Every surface, text and accent
 * comes from `src/theme/tokens.ts`, which is mirrored by
 * `tailwind.config.js`; this file only wires the navigation theme to the
 * same values so the native stack background never flashes a light colour
 * between screens.
 */

// NativeWind: must be imported once here so Metro inlines the Tailwind CSS.
import '../../global.css';

import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';

import { DarkTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { CredentialStore } from '@/auth/credential-store';
import { secureStoreBackend } from '@/auth/secure-backend';
import { SessionProvider } from '@/auth/session';
import { Color } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Keeps the app portrait everywhere except the keyboard tab, which is allowed
 * to rotate so its matrix can use the wider landscape viewport. A tab screen
 * cannot carry a per-screen `orientation` option (that is a native-stack
 * feature), so the lock is applied at runtime instead.
 */
function OrientationGuard() {
  const pathname = usePathname();
  const keyboardFocused = pathname.endsWith('/keyboard');

  useEffect(() => {
    const request = keyboardFocused
      ? ScreenOrientation.unlockAsync()
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    request.catch(() => undefined);
  }, [keyboardFocused]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Syne_700Bold,
    Syne_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const store = useMemo(
    () => new CredentialStore(secureStoreBackend()),
    [],
  );

  const theme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: Color.bg,
        card: Color.surface,
        primary: Color.accent,
        border: Color.border,
        text: Color.text,
        notification: Color.danger,
      },
    }),
    [],
  );

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }

    if (fontError) {
      console.warn(
        'Font loading failed; falling back to system fonts.',
        fontError,
      );
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={theme}>
      <SessionProvider store={store}>
        <OrientationGuard />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: Color.bg,
            },
            animation: 'fade',
          }}
        />
      </SessionProvider>
    </ThemeProvider>
  );
}

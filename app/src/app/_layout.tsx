/**
 * Root layout: loads the brand fonts, mounts the session provider,
 * and declares the stack for the pairing flow.
 *
 * Uses a clean Native Cloud aesthetic instead of the cyberpunk theme.
 */

// NativeWind: must be imported once here so Metro inlines the Tailwind CSS.
import '../../global.css';

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { CredentialStore } from '@/auth/credential-store';
import { secureStoreBackend } from '@/auth/secure-backend';
import { SessionProvider } from '@/auth/session';
import { Color } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
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
        background: '#F8FAFC',
        card: '#FFFFFF',
        primary: '#64748B',
        border: '#E2E8F0',
        text: '#0F172A',
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
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: '#F8FAFC',
            },
            animation: 'fade',
          }}
        />
      </SessionProvider>
    </ThemeProvider>
  );
}
import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#CAF300',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0B0E14',
          borderTopColor: '#1F2430',
          borderTopWidth: 1,
          height: 60 + (insets.bottom > 0 ? insets.bottom - 4 : 8),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 6,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Platform.select({ ios: 'JetBrains Mono', android: 'JetBrains Mono', default: 'monospace' }),
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="trackpad"
        options={{
          title: 'TRACKPAD',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "gesture-tap-box" : "gesture-tap-button"}
              size={22}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="media"
        options={{
          title: 'STUDIO',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "tune-vertical" : "tune-vertical-variant"}
              size={22}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="telemetry"
        options={{
          title: 'TELEMETRY',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "gauge" : "gauge-empty"}
              size={22}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="power"
        options={{
          title: 'POWER',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name="power-standby"
              size={22}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SYSTEM',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "information" : "information-outline"}
              size={22}
              color={color as any}
            />
          ),
        }}
      />
    </Tabs>
  );
}

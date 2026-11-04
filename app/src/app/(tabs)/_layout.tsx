import React, { useState, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarBottomInset } from '@/hooks/use-tab-bar-clearance';

interface TabItemProps {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function getTabConfig(name: string, isFocused: boolean): {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
} {
  switch (name) {
    case 'trackpad':
      return {
        icon: isFocused ? 'gesture-tap-box' : 'gesture-tap-button',
        label: 'PAD',
      };
    case 'keyboard':
      return {
        icon: isFocused ? 'keyboard' : 'keyboard-outline',
        label: 'KEYS',
      };
    case 'media':
      return {
        icon: isFocused ? 'tune-vertical' : 'tune-vertical-variant',
        label: 'MEDIA',
      };
    case 'telemetry':
      return {
        icon: isFocused ? 'view-dashboard' : 'view-dashboard-outline',
        label: 'STATUS',
      };
    case 'power':
      return {
        icon: 'power-standby',
        label: 'POWER',
      };
    case 'settings':
      return {
        icon: isFocused ? 'cog' : 'cog-outline',
        label: 'SYSTEM',
      };
    default:
      return {
        icon: 'circle',
        label: name.slice(0, 4).toUpperCase(),
      };
  }
}

const TabRadioItem = React.memo(function TabRadioItem({
  routeName,
  isFocused,
  onPress,
  onLongPress,
}: TabItemProps) {
  const [scale] = useState(() => new Animated.Value(isFocused ? 1.08 : 1));
  const [glowOpacity] = useState(() => new Animated.Value(isFocused ? 1 : 0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isFocused ? 1.08 : 1,
        friction: 6,
        tension: 130,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: isFocused ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused, scale, glowOpacity]);

  const { icon, label } = getTabConfig(routeName, isFocused);
  const activeColor = '#CAF300';
  const inactiveColor = '#64748B';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      onLongPress={onLongPress}
      className={`relative flex-1 h-14 items-center justify-center rounded-2xl border transition-all ${
        isFocused
          ? 'bg-[#121722] border-[#CAF300]/30 shadow-md shadow-black'
          : 'bg-transparent border-transparent'
      }`}
    >
      {/* Laser Top Indicator Line */}
      {isFocused && (
        <View className="absolute top-1 w-5 h-[2px] rounded-full bg-[#CAF300]" />
      )}

      {/* Subtle Glow behind the active icon */}
      <Animated.View
        pointerEvents="none"
        className="absolute w-8 h-8 rounded-full bg-[#CAF300]/10"
        style={{ opacity: glowOpacity }}
      />

      <Animated.View
        className="items-center justify-center"
        style={{ transform: [{ scale }] }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={isFocused ? activeColor : inactiveColor}
        />
        <Text
          className={`font-mono text-[9px] mt-0.5 tracking-wider ${
            isFocused ? 'text-[#CAF300] font-black' : 'text-zinc-500 font-medium'
          }`}
        >
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

const FloatingRadioTabBar = (props: any) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = props?.state;

  if (!state?.routes) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 items-center justify-center px-4 bg-transparent"
      style={{ paddingBottom: tabBarBottomInset(insets) }}
    >
      {/* Outer Tactical Cockpit Dock */}
      <View className="flex-row w-full bg-[#080B11]/95  shadow-2xl shadow-black">
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;

          const onPress = () => {
            if (!isFocused) {
              router.push(`/(tabs)/${route.name}` as any);
            }
          };

          return (
            <TabRadioItem
              key={route.key}
              routeName={route.name}
              label={route.name}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={() => undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingRadioTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="trackpad" options={{ title: 'TRACKPAD' }} />
      <Tabs.Screen name="keyboard" options={{ title: 'KEYBOARD' }} />
      <Tabs.Screen name="media" options={{ title: 'STUDIO' }} />
      <Tabs.Screen name="telemetry" options={{ title: 'TELEMETRY' }} />
      <Tabs.Screen name="power" options={{ title: 'POWER' }} />
      <Tabs.Screen name="settings" options={{ title: 'SYSTEM' }} />
    </Tabs>
  );
}
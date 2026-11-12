import React, { useState, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarBottomInset } from '@/hooks/use-tab-bar-clearance';
import { Color } from '@/theme/tokens';

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
  const activeColor = Color.accent;
  const inactiveColor = Color.textDim || '#81766B';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      onLongPress={onLongPress}
      style={
        isFocused
          ? {
              backgroundColor: Color.surfaceHigh || '#292522',
              borderColor: `${Color.accent}4D`,
            }
          : undefined
      }
      className={`relative flex-1 h-14 items-center justify-center rounded-2xl border transition-all ${
        isFocused ? 'shadow-md shadow-black' : 'bg-transparent border-transparent'
      }`}
    >
      {/* Laser Top Indicator Line */}
      {isFocused && (
        <View
          style={{ backgroundColor: Color.accent }}
          className="absolute top-1 w-5 h-[2px] rounded-full"
        />
      )}

      {/* Subtle Glow behind the active icon */}
      <Animated.View
        pointerEvents="none"
        style={{ opacity: glowOpacity, backgroundColor: `${Color.accent}1A` }}
        className="absolute w-8 h-8 rounded-full"
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
          style={{ color: isFocused ? Color.accent : inactiveColor }}
          className={`font-mono text-[9px] mt-0.5 tracking-wider ${
            isFocused ? 'font-black' : 'font-medium'
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
      className="absolute bottom-0 left-0 right-0 items-center justify-center bg-transparent"
      style={{
        paddingBottom: tabBarBottomInset(insets),
        paddingLeft: Math.max(insets.left, 16),
        paddingRight: Math.max(insets.right, 16),
      }}
    >
      {/* Outer Tactical Cockpit Dock */}
      <View
        style={{
          backgroundColor: Color.bg,
          borderColor: Color.border,
        }}
        className="flex-row w-full max-w-[560px] overflow-hidden rounded-3xl border shadow-2xl shadow-black"
      >
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
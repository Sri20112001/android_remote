import React, { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabItemProps {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function getTabIconName(name: string, isFocused: boolean): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (name) {
    case 'trackpad':
      return isFocused ? 'gesture-tap-box' : 'gesture-tap-button';
    case 'media':
      return isFocused ? 'tune-vertical' : 'tune-vertical-variant';
    case 'telemetry':
      return isFocused ? 'view-dashboard' : 'view-dashboard-outline';
    case 'power':
      return 'power-standby';
    case 'settings':
      return isFocused ? 'cog' : 'cog-outline';
    default:
      return 'circle';
  }
}

function TabRadioItem({ routeName, isFocused, onPress, onLongPress }: TabItemProps) {
  const scale = useRef(new Animated.Value(isFocused ? 1.25 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isFocused ? 1.25 : 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [isFocused, scale]);

  const iconName = getTabIconName(routeName, isFocused);
  const activeColor = '#38BDF8'; // peer-checked/expand:text-blue-400
  const inactiveColor = '#64748B';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.tabRadioItem,
        isFocused && styles.tabRadioItemActive,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <MaterialCommunityIcons
          name={iconName}
          size={24}
          color={isFocused ? activeColor : inactiveColor}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

function FloatingRadioTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.tabBarArticle}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabRadioItem
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
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
      <Tabs.Screen name="media" options={{ title: 'STUDIO' }} />
      <Tabs.Screen name="telemetry" options={{ title: 'TELEMETRY' }} />
      <Tabs.Screen name="power" options={{ title: 'POWER' }} />
      <Tabs.Screen name="settings" options={{ title: 'SYSTEM' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  tabBarArticle: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#0F131C',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2538',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  tabRadioItem: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabRadioItemActive: {
    backgroundColor: '#161D2B',
    borderColor: '#243048',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
});

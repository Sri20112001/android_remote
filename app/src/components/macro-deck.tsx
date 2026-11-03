import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAgentWS } from '@/api/use-agent-ws';
import { triggerHaptic } from '@/utils/haptics';

interface MacroTileProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  subLabel?: string;
  onPress: () => void;
}

function MacroTile({ label, icon, color, subLabel, onPress }: MacroTileProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.92, friction: 6, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    triggerHaptic.light();
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.tileWrapper]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[styles.tileButton, { borderColor: color + '40' }]}
      >
        <View style={[styles.tileIconContainer, { backgroundColor: color + '15' }]}>
          <MaterialCommunityIcons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
        {subLabel && <Text style={styles.tileSubLabel}>{subLabel}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MacroDeck() {
  const { launchApp, sendKeyTap, lockWorkstation } = useAgentWS();

  const apps = [
    { label: 'CHROME', icon: 'google-chrome' as const, color: '#38BDF8', app: 'chrome', sub: 'WEB' },
    { label: 'SPOTIFY', icon: 'spotify' as const, color: '#22f49e', app: 'spotify', sub: 'AUDIO' },
    { label: 'VS CODE', icon: 'microsoft-visual-studio-code' as const, color: '#38BDF8', app: 'code', sub: 'DEV' },
    { label: 'CALC', icon: 'calculator' as const, color: '#CAF300', app: 'calc', sub: 'MATH' },
    { label: 'TERMINAL', icon: 'console' as const, color: '#F59E0B', app: 'terminal', sub: 'CLI' },
    { label: 'TASK MGR', icon: 'chart-box-outline' as const, color: '#EF4444', app: 'taskmgr', sub: 'SYS' },
  ];

  const shortcuts = [
    {
      label: 'DESKTOP',
      sub: 'WIN+D',
      icon: 'monitor-dashboard' as const,
      color: '#CAF300',
      action: () => sendKeyTap('d', ['win']),
    },
    {
      label: 'SNIP TOOL',
      sub: 'WIN+SH+S',
      icon: 'crop' as const,
      color: '#38BDF8',
      action: () => sendKeyTap('s', ['win', 'shift']),
    },
    {
      label: 'SWITCHER',
      sub: 'ALT+TAB',
      icon: 'dock-window' as const,
      color: '#A855F7',
      action: () => sendKeyTap('tab', ['alt']),
    },
    {
      label: 'CLOSE WIN',
      sub: 'ALT+F4',
      icon: 'window-close' as const,
      color: '#EF4444',
      action: () => sendKeyTap('f4', ['alt']),
    },
    {
      label: 'FULLSCREEN',
      sub: 'F11',
      icon: 'fullscreen' as const,
      color: '#22f49e',
      action: () => sendKeyTap('f11', []),
    },
    {
      label: 'REFRESH',
      sub: 'F5',
      icon: 'refresh' as const,
      color: '#F59E0B',
      action: () => sendKeyTap('f5', []),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Category Header 1: Quick App Launcher */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: '#38BDF8' }]} />
          <Text style={styles.sectionTitle}>STREAM DECK // APPS</Text>
        </View>
        <Text style={styles.badgeText}>QUICK LAUNCH</Text>
      </View>

      <View style={styles.grid}>
        {apps.map((item) => (
          <MacroTile
            key={item.label}
            label={item.label}
            subLabel={item.sub}
            icon={item.icon}
            color={item.color}
            onPress={() => launchApp(item.app).catch(() => undefined)}
          />
        ))}
      </View>

      {/* Category Header 2: Windows System Chords */}
      <View style={[styles.sectionHeader, { marginTop: 18 }]}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: '#CAF300' }]} />
          <Text style={styles.sectionTitle}>TACTICAL CHORDS // MACROS</Text>
        </View>
        <Text style={styles.badgeText}>HOTKEYS</Text>
      </View>

      <View style={styles.grid}>
        {shortcuts.map((item) => (
          <MacroTile
            key={item.label}
            label={item.label}
            subLabel={item.sub}
            icon={item.icon}
            color={item.color}
            onPress={item.action}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#10141D',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
  badgeText: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  tileWrapper: {
    width: '31%',
  },
  tileButton: {
    backgroundColor: '#0D1117',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 4,
  },
  tileIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: {
    color: '#F1F5F9',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
    textAlign: 'center',
  },
  tileSubLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '600',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
});

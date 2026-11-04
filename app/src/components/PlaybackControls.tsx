import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerHaptic } from '@/utils/haptics';
import { SeekMode } from '../types/types';

interface PlaybackControlsProps {
  seekMode: SeekMode;
  onSendKey: (key: string) => void;
}

export function PlaybackControls({ seekMode, onSendKey }: PlaybackControlsProps) {
  const [playScale] = useState(() => new Animated.Value(1));
  const [prevScale] = useState(() => new Animated.Value(1));
  const [nextScale] = useState(() => new Animated.Value(1));
  const [rewindScale] = useState(() => new Animated.Value(1));
  const [forwardScale] = useState(() => new Animated.Value(1));

  const pressSpring = (anim: Animated.Value, action: () => void) => {
    triggerHaptic.light();
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    action();
  };

  return (
    <View className="gap-2">
      <Text className="text-[#64748B] text-[9px] font-bold font-mono tracking-wider">
        PLAYBACK CONTROLS
      </Text>
      <View className="flex-row gap-1.5">
        {/* PREV */}
        <Animated.View className="flex-1" style={{ transform: [{ scale: prevScale }] }}>
          <TouchableOpacity
            className="w-full bg-[#161D2B] rounded-xl py-3 items-center justify-center border border-[#243048] gap-1"
            activeOpacity={0.8}
            onPress={() => pressSpring(prevScale, () => onSendKey('media_prev'))}
          >
            <MaterialCommunityIcons name="skip-previous" size={22} color="#F1F5F9" />
            <Text className="text-[#94A3B8] text-[8px] font-bold font-mono">PREV</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* -10S REWIND */}
        <Animated.View className="flex-[1.1]" style={{ transform: [{ scale: rewindScale }] }}>
          <TouchableOpacity
            className="w-full bg-[#0F1E2E] rounded-xl py-3 items-center justify-center border border-[#1E3A5F] gap-1"
            activeOpacity={0.8}
            onPress={() =>
              pressSpring(rewindScale, () =>
                onSendKey(seekMode === 'web' ? 'j' : 'left')
              )
            }
          >
            <MaterialCommunityIcons name="rewind-10" size={24} color="#38BDF8" />
            <Text className="text-[#38BDF8] text-[8px] font-[800] font-mono">-10s</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* PLAY/PAUSE */}
        <Animated.View className="flex-[1.4]" style={{ transform: [{ scale: playScale }] }}>
          <TouchableOpacity
            className="w-full bg-[#CAF300] rounded-xl py-3 items-center justify-center border border-[#CAF300] gap-1"
            activeOpacity={0.8}
            onPress={() => pressSpring(playScale, () => onSendKey('media_play_pause'))}
          >
            <MaterialCommunityIcons name="play-pause" size={28} color="#000000" />
            <Text className="text-black text-[8px] font-[900] font-mono">PLAY/PAUSE</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* +10S FORWARD */}
        <Animated.View className="flex-[1.1]" style={{ transform: [{ scale: forwardScale }] }}>
          <TouchableOpacity
            className="w-full bg-[#0F1E2E] rounded-xl py-3 items-center justify-center border border-[#1E3A5F] gap-1"
            activeOpacity={0.8}
            onPress={() =>
              pressSpring(forwardScale, () =>
                onSendKey(seekMode === 'web' ? 'l' : 'right')
              )
            }
          >
            <MaterialCommunityIcons name="fast-forward-10" size={24} color="#38BDF8" />
            <Text className="text-[#38BDF8] text-[8px] font-[800] font-mono">+10s</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* NEXT */}
        <Animated.View className="flex-1" style={{ transform: [{ scale: nextScale }] }}>
          <TouchableOpacity
            className="w-full bg-[#161D2B] rounded-xl py-3 items-center justify-center border border-[#243048] gap-1"
            activeOpacity={0.8}
            onPress={() => pressSpring(nextScale, () => onSendKey('media_next'))}
          >
            <MaterialCommunityIcons name="skip-next" size={22} color="#F1F5F9" />
            <Text className="text-[#94A3B8] text-[8px] font-bold font-mono">NEXT</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
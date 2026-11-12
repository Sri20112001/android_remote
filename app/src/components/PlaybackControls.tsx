
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerHaptic } from '@/utils/haptics';
import { SeekMode } from '../types/types';

interface PlaybackControlsProps {
  seekMode: SeekMode;
  onSendKey: (key: string) => void;
}

const C = {
  surface: '#17191D',
  surfaceHigh: '#22252A',
  border: '#34383F',
  borderStrong: '#4A5059',
  accent: '#A8B4C4',
  accentLight: '#D5DCE5',
  text: '#F0F1F3',
  textDim: '#A5A9B0',
  textFaint: '#747A84',
  onAccent: '#0D0E10',
};

export function PlaybackControls({
  seekMode,
  onSendKey,
}: PlaybackControlsProps) {
  const [playScale] = useState(() => new Animated.Value(1));
  const [prevScale] = useState(() => new Animated.Value(1));
  const [nextScale] = useState(() => new Animated.Value(1));
  const [rewindScale] = useState(() => new Animated.Value(1));
  const [forwardScale] = useState(() => new Animated.Value(1));

  const pressSpring = (anim: Animated.Value, action: () => void) => {
    triggerHaptic.light();

    Animated.sequence([
      Animated.timing(anim, {
        toValue: 0.88,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.spring(anim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    action();
  };

  return (
    <View className="gap-2">
      <Text
        className="text-[9px] font-bold font-mono tracking-wider"
        style={{ color: C.textFaint }}
      >
        PLAYBACK CONTROLS
      </Text>

      <View className="flex-row gap-1.5">
        {/* PREV */}
        <Animated.View
          className="flex-1"
          style={{ transform: [{ scale: prevScale }] }}
        >
          <TouchableOpacity
            className="w-full rounded-xl py-3 items-center justify-center border gap-1"
            style={{
              backgroundColor: C.surface,
              borderColor: C.border,
            }}
            activeOpacity={0.8}
            onPress={() =>
              pressSpring(prevScale, () => onSendKey('media_prev'))
            }
          >
            <MaterialCommunityIcons
              name="skip-previous"
              size={22}
              color={C.text}
            />
            <Text
              className="text-[8px] font-bold font-mono"
              style={{ color: C.textDim }}
            >
              PREV
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* -10S REWIND */}
        <Animated.View
          className="flex-[1.1]"
          style={{ transform: [{ scale: rewindScale }] }}
        >
          <TouchableOpacity
            className="w-full rounded-xl py-3 items-center justify-center border gap-1"
            style={{
              backgroundColor: C.surfaceHigh,
              borderColor: C.borderStrong,
            }}
            activeOpacity={0.8}
            onPress={() =>
              pressSpring(rewindScale, () =>
                onSendKey(seekMode === 'web' ? 'j' : 'left')
              )
            }
          >
            <MaterialCommunityIcons
              name="rewind-10"
              size={24}
              color={C.accentLight}
            />
            <Text
              className="text-[8px] font-extrabold font-mono"
              style={{ color: C.accentLight }}
            >
              -10s
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* PLAY / PAUSE */}
        <Animated.View
          className="flex-[1.4]"
          style={{ transform: [{ scale: playScale }] }}
        >
          <TouchableOpacity
            className="w-full rounded-xl py-3 items-center justify-center border gap-1"
            style={{
              backgroundColor: C.accent,
              borderColor: C.accentLight,
            }}
            activeOpacity={0.8}
            onPress={() =>
              pressSpring(playScale, () => onSendKey('media_play_pause'))
            }
          >
            <MaterialCommunityIcons
              name="play-pause"
              size={28}
              color={C.onAccent}
            />
            <Text
              className="text-[8px] font-black font-mono"
              style={{ color: C.onAccent }}
            >
              PLAY/PAUSE
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* +10S FORWARD */}
        <Animated.View
          className="flex-[1.1]"
          style={{ transform: [{ scale: forwardScale }] }}
        >
          <TouchableOpacity
            className="w-full rounded-xl py-3 items-center justify-center border gap-1"
            style={{
              backgroundColor: C.surfaceHigh,
              borderColor: C.borderStrong,
            }}
            activeOpacity={0.8}
            onPress={() =>
              pressSpring(forwardScale, () =>
                onSendKey(seekMode === 'web' ? 'l' : 'right')
              )
            }
          >
            <MaterialCommunityIcons
              name="fast-forward-10"
              size={24}
              color={C.accentLight}
            />
            <Text
              className="text-[8px] font-extrabold font-mono"
              style={{ color: C.accentLight }}
            >
              +10s
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* NEXT */}
        <Animated.View
          className="flex-1"
          style={{ transform: [{ scale: nextScale }] }}
        >
          <TouchableOpacity
            className="w-full rounded-xl py-3 items-center justify-center border gap-1"
            style={{
              backgroundColor: C.surface,
              borderColor: C.border,
            }}
            activeOpacity={0.8}
            onPress={() =>
              pressSpring(nextScale, () => onSendKey('media_next'))
            }
          >
            <MaterialCommunityIcons
              name="skip-next"
              size={22}
              color={C.text}
            />
            <Text
              className="text-[8px] font-bold font-mono"
              style={{ color: C.textDim }}
            >
              NEXT
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

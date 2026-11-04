import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgentWS } from '@/api/use-agent-ws';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { triggerHaptic } from '@/utils/haptics';

import { SeekMode } from '../../types/types';

import { StereoVuMeter } from '@/components/StereoVuMeter';
import { MasterFader } from '@/components/MasterFader';
import { TvRemoteDpad } from '@/components/TvRemoteDpad';
import { PlaybackControls } from '@/components/PlaybackControls';
import { DualRockers } from '@/components/DualRockers';

const FADER_TRACK_HEIGHT = 160;
const fader = { volume: 50, start: 50, lastSend: 0 };

export default function MediaStudioScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { isConnected, setVolume, toggleMute, getAudioStatus, sendKeyTap } = useAgentWS();

  const [volume, setVolumeState] = useState<number>(50);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [seekMode, setSeekMode] = useState<SeekMode>('web');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    fader.volume = volume;
  }, [volume]);

  // Pulse animation for bus header
  const [busPulse] = useState(() => new Animated.Value(0.4));
  const [muteScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(busPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(busPulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [busPulse]);

  // Sync initial state from agent
  useEffect(() => {
    if (isConnected) {
      getAudioStatus()
        .then((status) => {
          if (status) {
            setVolumeState(status.level);
            fader.volume = status.level;
            setIsMuted(status.muted);
          }
        })
        .catch(() => undefined);
    }
  }, [isConnected, getAudioStatus]);

  // Volume PanResponder
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        fader.start = fader.volume;
        setIsDragging(true);
      },

      onPanResponderMove: (_, gestureState) => {
        const deltaPercent = -(gestureState.dy / FADER_TRACK_HEIGHT) * 100;
        const target = Math.max(0, Math.min(100, Math.round(fader.start + deltaPercent)));

        if (Math.floor(target / 10) !== Math.floor(fader.volume / 10)) {
          triggerHaptic.selection();
        }

        setVolumeState(target);
        fader.volume = target;

        const now = Date.now();
        if (now - fader.lastSend > 90) {
          fader.lastSend = now;
          setVolume(target).catch(() => undefined);
        }
      },

      onPanResponderRelease: () => {
        setIsDragging(false);
        const finalVol = fader.volume;
        fader.lastSend = Date.now();
        setVolume(finalVol).catch(() => undefined);
      },

      onPanResponderTerminate: () => {
        setIsDragging(false);
        const finalVol = fader.volume;
        fader.lastSend = Date.now();
        setVolume(finalVol).catch(() => undefined);
      },
    })
  );

  const handleToggleMute = () => {
    triggerHaptic.medium();
    Animated.sequence([
      Animated.timing(muteScale, { toValue: 0.92, duration: 70, useNativeDriver: true }),
      Animated.spring(muteScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    toggleMute()
      .then(() => setIsMuted((prev) => !prev))
      .catch(() => undefined);
  };

  const handleQuickVolume = (val: number) => {
    triggerHaptic.selection();
    setVolumeState(val);
    setVolume(val).catch(() => undefined);
  };

  const dbfs = volume === 0 ? '-inf' : ((volume - 100) * 0.4).toFixed(1);

  return (
    <ScrollView
      className="flex-1 bg-[#0B0E14]"
      style={{ paddingTop: Math.max(insets.top, 12) }}
      contentContainerStyle={{ paddingBottom: tabBarClearance }}
    >
      <View className="px-3.5 gap-3">
        {/* Top Bus Header */}
        <View className="bg-[#10141D] rounded-[14px] p-3 border border-[#1E2538] gap-2">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-1.5">
              <Animated.View
                className="w-1.5 h-1.5 rounded-full bg-[#CAF300]"
                style={{ opacity: busPulse }}
              />
              <Text className="text-[#F1F5F9] text-xs font-bold tracking-wide font-mono">
                {'// MASTER_AUDIO_BUS'}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 bg-[#1E293B] px-2 py-0.5 rounded-md">
              <MaterialCommunityIcons name="tune" size={12} color="#CAF300" />
              <Text className="text-[#CAF300] text-[9px] font-bold font-mono">
                WASAPI DIRECT
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5 bg-[#090C12] px-2.5 py-1.5 rounded-lg">
            <MaterialCommunityIcons name="equalizer" size={14} color="#CAF300" />
            <Text className="flex-1 text-[#94A3B8] text-[11px] font-mono" numberOfLines={1}>
              WINDOWS CORE AUDIO // 24-BIT MASTER
            </Text>
            <Text className="text-[#CAF300] text-[9px] font-bold bg-[#17202A] px-1.5 py-0.5 rounded">
              ACTIVE
            </Text>
          </View>
        </View>

        {/* Main Console Deck */}
        <View className="bg-[#10141D] rounded-2xl p-3.5 border border-[#1E2538] gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-[#64748B] text-[10px] font-bold font-mono">
              ANALOG STAGE // DECK 01
            </Text>
            <Text className="text-[#CAF300] text-[11px] font-bold font-mono">
              LEVEL: {dbfs} dBFS
            </Text>
          </View>

          <View className="flex-row gap-3">
            <StereoVuMeter volume={volume} isMuted={isMuted} />
            <MasterFader
              volume={volume}
              isDragging={isDragging}
              panHandlers={panResponder.panHandlers}
            />
          </View>

          {/* Quick Level Snap Buttons */}
          <View className="flex-row gap-1.5">
            {[0, 25, 50, 75, 100].map((lvl) => (
              <TouchableOpacity
                key={lvl}
                className={`flex-1 py-2 rounded-lg items-center border ${
                  volume === lvl
                    ? 'bg-[#CAF300] border-[#CAF300]'
                    : 'bg-[#131822] border-[#1E2538]'
                }`}
                onPress={() => handleQuickVolume(lvl)}
              >
                <Text
                  className={`text-[11px] font-bold font-mono ${
                    volume === lvl ? 'text-black' : 'text-[#94A3B8]'
                  }`}
                >
                  {lvl}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tactical TV Remote Card */}
        <View className="bg-[#10141D] rounded-[20px] p-4 border border-[#1E2538] gap-3.5 shadow-lg">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-1.5">
              <View className="w-[7px] h-[7px] rounded-full bg-[#CAF300] shadow-sm" />
              <Text className="text-[#F1F5F9] text-xs font-[800] tracking-wider font-mono">
                TACTICAL TV REMOTE
              </Text>
            </View>
            <View className="flex-row items-center gap-1 bg-[#161D2B] px-2 py-0.5 rounded-md border border-[#243048]">
              <MaterialCommunityIcons name="remote" size={14} color="#CAF300" />
              <Text className="text-[#CAF300] text-[9px] font-bold font-mono">
                IR DIRECT
              </Text>
            </View>
          </View>

          {/* 10s Seek Mode */}
          <View className="bg-[#090C12] p-2 rounded-xl border border-[#19202E] gap-1.5">
            <Text className="text-[#64748B] text-[9px] font-bold font-mono">
              10S SEEK MODE:
            </Text>
            <View className="flex-row gap-1.5">
              <TouchableOpacity
                className={`flex-1 py-1.5 rounded-md items-center border ${
                  seekMode === 'web'
                    ? 'bg-[#1E293B] border-[#CAF300]'
                    : 'bg-[#131924] border-[#1F293D]'
                }`}
                onPress={() => setSeekMode('web')}
              >
                <Text
                  className={`text-[9px] font-bold font-mono ${
                    seekMode === 'web' ? 'text-[#CAF300]' : 'text-[#64748B]'
                  }`}
                >
                  WEB / YOUTUBE (J / L)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 py-1.5 rounded-md items-center border ${
                  seekMode === 'player'
                    ? 'bg-[#1E293B] border-[#CAF300]'
                    : 'bg-[#131924] border-[#1F293D]'
                }`}
                onPress={() => setSeekMode('player')}
              >
                <Text
                  className={`text-[9px] font-bold font-mono ${
                    seekMode === 'player' ? 'text-[#CAF300]' : 'text-[#64748B]'
                  }`}
                >
                  PLAYER (ARROWS)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Top Function Keys */}
          <View className="flex-row gap-2">
            <Animated.View className="flex-1" style={{ transform: [{ scale: muteScale }] }}>
              <TouchableOpacity
                className={`w-full rounded-xl py-2.5 items-center justify-center border gap-1 ${
                  isMuted
                    ? 'bg-[#3B1219] border-[#7F1D1D]'
                    : 'bg-[#161D2B] border-[#243048]'
                }`}
                activeOpacity={0.8}
                onPress={handleToggleMute}
              >
                <MaterialCommunityIcons
                  name={isMuted ? 'volume-variant-off' : 'volume-high'}
                  size={20}
                  color={isMuted ? '#EF4444' : '#CAF300'}
                />
                <Text
                  className={`text-[9px] font-bold font-mono ${
                    isMuted ? 'text-[#EF4444]' : 'text-[#94A3B8]'
                  }`}
                >
                  {isMuted ? 'UNMUTE' : 'MUTE'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              className="flex-1 bg-[#161D2B] rounded-xl py-2.5 items-center justify-center border border-[#243048] gap-1"
              activeOpacity={0.8}
              onPress={() => sendKeyTap('f')}
            >
              <MaterialCommunityIcons name="fullscreen" size={20} color="#38BDF8" />
              <Text className="text-[#94A3B8] text-[9px] font-bold font-mono">FULL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-[#161D2B] rounded-xl py-2.5 items-center justify-center border border-[#243048] gap-1"
              activeOpacity={0.8}
              onPress={() => sendKeyTap('esc')}
            >
              <MaterialCommunityIcons name="keyboard-backspace" size={20} color="#F1F5F9" />
              <Text className="text-[#94A3B8] text-[9px] font-bold font-mono">BACK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-[#161D2B] rounded-xl py-2.5 items-center justify-center border border-[#243048] gap-1"
              activeOpacity={0.8}
              onPress={() => sendKeyTap('win')}
            >
              <MaterialCommunityIcons name="microsoft-windows" size={20} color="#F59E0B" />
              <Text className="text-[#94A3B8] text-[9px] font-bold font-mono">HOME</Text>
            </TouchableOpacity>
          </View>

          {/* D-PAD */}
          <TvRemoteDpad onSendKey={sendKeyTap} />

          {/* PLAYBACK CONTROLS */}
          <PlaybackControls seekMode={seekMode} onSendKey={sendKeyTap} />

          {/* DUAL ROCKERS */}
          <DualRockers onSendKey={sendKeyTap} />
        </View>
      </View>
    </ScrollView>
  );
}
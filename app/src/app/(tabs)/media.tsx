
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAgentWS, NowPlayingInfo } from '@/api/use-agent-ws';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { triggerHaptic } from '@/utils/haptics';
import { SeekMode } from '../../types/types';

import { TvRemoteDpad } from '@/components/TvRemoteDpad';
import { PlaybackControls } from '@/components/PlaybackControls';
import { DualRockers } from '@/components/DualRockers';

const C = {
  bg: '#11100F',
  surface: '#1C1916',
  surfaceHigh: '#292522',
  border: '#443A32',
  borderStrong: '#5B4B3D',
  bronze: '#B78350',
  bronzeDim: '#8A6546',
  champagne: '#D6B88C',
  text: '#E9E1D7',
  textDim: '#A99B8C',
  muted: '#81766B',
  danger: '#E06455',
  dangerBg: '#351D19',
  success: '#91A878',
};

export default function MediaStudioScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();

  const {
    isConnected,
    toggleMute,
    sendKeyTap,
    getNowPlaying,
  } = useAgentWS();

  const [isMuted, setIsMuted] = useState(false);
  const [seekMode, setSeekMode] = useState<SeekMode>('web');
  const [nowPlaying, setNowPlaying] = useState<NowPlayingInfo | null>(null);

  const [muteScale] = useState(() => new Animated.Value(1));
  const [busPulse] = useState(() => new Animated.Value(0.4));

  // Poll now playing metadata periodically
  useEffect(() => {
    if (!isConnected) return;
    const fetchNowPlaying = () => {
      getNowPlaying()
        .then((info) => setNowPlaying(info))
        .catch(() => undefined);
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 4000);
    return () => clearInterval(interval);
  }, [isConnected, getNowPlaying]);

  // Connection pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(busPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(busPulse, {
          toValue: 0.35,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [busPulse]);

  // Mute handler
  const handleToggleMute = () => {
    triggerHaptic.medium();

    Animated.sequence([
      Animated.timing(muteScale, {
        toValue: 0.92,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(muteScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    toggleMute()
      .then(() => setIsMuted(prev => !prev))
      .catch(() => undefined);
  };

  const handleSeekMode = (mode: SeekMode) => {
    triggerHaptic.selection();
    setSeekMode(mode);
  };

  // Reusable function key
  const FunctionKey = ({
    icon,
    label,
    onPress,
    active = false,
    danger = false,
  }: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    onPress: () => void;
    active?: boolean;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      className="flex-1 flex-row rounded-xl items-center justify-center py-1.5 gap-2 border"
      style={{
        backgroundColor: danger ? C.dangerBg : active ? '#33271D' : C.surfaceHigh,
        borderColor: danger ? '#754137' : active ? C.bronze : C.border,
      }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={21}
        color={danger ? C.danger : C.bronze}
      />

      {/* <Text
        className="text-[9px] font-bold tracking-widest"
        style={{ color: danger ? C.danger : C.textDim }}
      >
        {label}
      </Text> */}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      className="flex-1"
      style={{
        backgroundColor: C.bg,
        paddingTop: Math.max(insets.top, 12),
      }}
      contentContainerStyle={{
        paddingBottom: tabBarClearance + 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 gap-5">

        {/* HEADER */}
        <View className="flex-row justify-between items-center pt-2">

          <View className="gap-1">


            <Text
              className="text-[27px] font-bold tracking-tight"
              style={{ color: C.text }}
            >
              Media Studio
            </Text>

            <Text
              className="text-xs"
              style={{ color: C.muted }}
            >
              Remote control interface
            </Text>
          </View>

          {/* CONNECTION STATUS */}
          <View
            className="rounded-xl px-3 py-2 items-center gap-1 border"
            style={{
              backgroundColor: C.surface,
              borderColor: C.border,
            }}
          >
            <Animated.View
              style={{
                opacity: busPulse,
                width: 7,
                height: 7,
                borderRadius: 10,
                backgroundColor: isConnected ? C.success : C.danger,
              }}
            />

            <Text
              className="text-[9px] font-bold tracking-widest"
              style={{
                color: isConnected ? C.success : C.danger,
              }}
            >
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>

        {/* NOW PLAYING HUD BANNER */}
        <View
          className="rounded-2xl p-4 border flex-row items-center gap-3.5"
          style={{
            backgroundColor: '#161310',
            borderColor: nowPlaying?.playing ? C.bronze : C.border,
          }}
        >
          <View
            className="w-11 h-11 rounded-xl items-center justify-center border"
            style={{
              backgroundColor: nowPlaying?.playing ? '#2E2218' : C.surfaceHigh,
              borderColor: nowPlaying?.playing ? C.bronze : C.border,
            }}
          >
            <MaterialCommunityIcons
              name={nowPlaying?.playing ? 'music-note' : 'music-note-off'}
              size={22}
              color={nowPlaying?.playing ? C.champagne : C.muted}
            />
          </View>

          <View className="flex-1 justify-center">
            <View className="flex-row items-center gap-2">
              <Text
                className="font-mono text-[9px] font-bold tracking-widest uppercase"
                style={{ color: nowPlaying?.playing ? C.champagne : C.muted }}
              >
                {nowPlaying?.player || 'MEDIA SYSTEM'}
              </Text>
              {nowPlaying?.playing && (
                <View className="px-1.5 py-0.5 rounded bg-[#332415] border border-[#6E4F32]">
                  <Text className="text-[8px] font-mono text-[#D6B88C] font-black tracking-widest">
                    LIVE
                  </Text>
                </View>
              )}
            </View>

            <Text
              numberOfLines={1}
              className="text-sm font-bold tracking-tight mt-0.5"
              style={{ color: C.text }}
            >
              {nowPlaying?.title || 'No active media playing'}
            </Text>

            <Text
              numberOfLines={1}
              className="text-xs font-mono"
              style={{ color: C.textDim }}
            >
              {nowPlaying?.artist || 'Ready for playback'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic.light();
              getNowPlaying()
                .then((info) => setNowPlaying(info))
                .catch(() => undefined);
            }}
            className="w-8 h-8 rounded-lg items-center justify-center border"
            style={{
              backgroundColor: C.surfaceHigh,
              borderColor: C.border,
            }}
          >
            <MaterialCommunityIcons name="refresh" size={16} color={C.textDim} />
          </TouchableOpacity>
        </View>

        {/* REMOTE CONSOLE */}
        <View
          className="rounded-2xl p-4 gap-5 border"
          style={{
            backgroundColor: C.surface,
            borderColor: C.border,
          }}
        >

          {/* CARD HEADER */}
          <View className="flex-row justify-between items-center">

            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons
                name="remote"
                size={19}
                color={C.bronze}
              />

              <Text
                className="text-xs font-bold tracking-widest"
                style={{ color: C.text }}
              >
                REMOTE CONTROL
              </Text>
            </View>

            <View
              className="flex-row items-center gap-1.5 rounded-md px-2.5 py-1 border"
              style={{
                backgroundColor: C.surfaceHigh,
                borderColor: C.border,
              }}
            >
              <View
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: C.bronze }}
              />

              <Text
                className="text-[9px] font-bold tracking-wider"
                style={{ color: C.champagne }}
              >
                IR DIRECT
              </Text>
            </View>
          </View>

          {/* SEEK MODE */}
          <View className="gap-2">

            <Text
              className="text-[9px] font-bold tracking-[2px]"
              style={{ color: C.muted }}
            >
              SEEK MODE / 10 SECONDS
            </Text>

            <View
              className="flex-row rounded-xl p-1 gap-1"
              style={{ backgroundColor: C.bg }}
            >

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSeekMode('web')}
                className="flex-1 rounded-lg py-1.5 items-center justify-center border"
                style={{
                  backgroundColor:
                    seekMode === 'web' ? '#443A32' : 'transparent',
                  borderColor:
                    seekMode === 'web' ? C.bronze : 'transparent',
                }}
              >
                <Text
                  className="text-[9px] font-bold tracking-wider"
                  style={{
                    color:
                      seekMode === 'web' ? C.champagne : C.muted,
                  }}
                >
                  WEB / YOUTUBE
                </Text>

                <Text
                  className="text-[8px] mt-1"
                  style={{ color: C.muted }}
                >
                  J / L KEYS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSeekMode('player')}
                className="flex-1 rounded-lg py-1.5 items-center justify-center border"
                style={{
                  backgroundColor:
                    seekMode === 'player' ? '#443A32' : 'transparent',
                  borderColor:
                    seekMode === 'player' ? C.bronze : 'transparent',
                }}
              >
                <Text
                  className="text-[9px] font-bold tracking-wider"
                  style={{
                    color:
                      seekMode === 'player' ? C.champagne : C.muted,
                  }}
                >
                  PLAYER
                </Text>

                <Text
                  className="text-[8px] mt-1"
                  style={{ color: C.muted }}
                >
                  ARROW KEYS
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DIVIDER */}
          <View
            style={{
              height: 1,
              backgroundColor: C.border,
            }}
          />

          {/* FUNCTION KEYS */}
          <View className="gap-2">

            <Text
              className="text-[9px] font-bold tracking-[2px]"
              style={{ color: C.muted }}
            >
              SYSTEM FUNCTIONS
            </Text>

            <View className="flex-row gap-2">

              <Animated.View
                className="flex-1"
                style={{ transform: [{ scale: muteScale }] }}
              >
                <FunctionKey
                  icon={isMuted ? 'volume-variant-off' : 'volume-high'}
                  label={isMuted ? 'UNMUTE' : 'MUTE'}
                  onPress={handleToggleMute}
                  active={isMuted}
                  danger={isMuted}
                />
              </Animated.View>

              <FunctionKey
                icon="fullscreen"
                label="FULL"
                onPress={() => sendKeyTap('f')}
              />

              <FunctionKey
                icon="keyboard-backspace"
                label="BACK"
                onPress={() => sendKeyTap('esc')}
              />

              <FunctionKey
                icon="home"
                label="HOME"
                onPress={() => sendKeyTap('win')}
              />

            </View>
          </View>

          {/* DIVIDER */}
          <View
            style={{
              height: 1,
              backgroundColor: C.border,
            }}
          />

          {/* DIRECTIONAL CONTROL */}
          <View className="gap-3">

            <View className="flex-row justify-between items-center">
              <Text
                className="text-[9px] font-bold tracking-[2px]"
                style={{ color: C.muted }}
              >
                NAVIGATION
              </Text>

              <Text
                className="text-[9px] font-bold"
                style={{ color: C.bronze }}
              >
                D-PAD
              </Text>
            </View>

            <View
              className="rounded-xl p-2 border"
              style={{
                backgroundColor: C.surfaceHigh,
                borderColor: C.border,
              }}
            >
              <TvRemoteDpad onSendKey={sendKeyTap} />
            </View>
          </View>

          {/* PLAYBACK */}
          <View className="gap-3">

            <View className="flex-row justify-between items-center">
              <Text
                className="text-[9px] font-bold tracking-[2px]"
                style={{ color: C.muted }}
              >
                MEDIA PLAYBACK
              </Text>

              <MaterialCommunityIcons
                name="play-circle-outline"
                size={17}
                color={C.bronze}
              />
            </View>

            <View
              className="rounded-xl p-2 border"
              style={{
                backgroundColor: C.surfaceHigh,
                borderColor: C.border,
              }}
            >
              <PlaybackControls
                seekMode={seekMode}
                onSendKey={sendKeyTap}
              />
            </View>
          </View>

          {/* DUAL ROCKERS */}
          <View className="gap-3">

            <View className="flex-row justify-between items-center">
              <Text
                className="text-[9px] font-bold tracking-[2px]"
                style={{ color: C.muted }}
              >
                AUXILIARY CONTROLS
              </Text>

              <MaterialCommunityIcons
                name="tune-variant"
                size={17}
                color={C.bronze}
              />
            </View>

            <View
              className="rounded-xl p-2 border"
              style={{
                backgroundColor: C.surfaceHigh,
                borderColor: C.border,
              }}
            >
              <DualRockers onSendKey={sendKeyTap} />
            </View>
          </View>

        </View>

        {/* FOOTER */}
        <View className="flex-row justify-between items-center px-1">

          <Text
            className="text-[9px] font-bold tracking-[2px]"
            style={{ color: C.muted }}
          >
            AETHER CONTROL DECK
          </Text>

          <Text
            className="text-[9px] font-bold tracking-wider"
            style={{ color: C.bronzeDim }}
          >
            SYSTEM / 01
          </Text>

        </View>

      </View>
    </ScrollView>
  );
}

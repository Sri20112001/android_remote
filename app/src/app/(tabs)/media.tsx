import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  StyleSheet,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgentWS } from '@/api/use-agent-ws';

const FADER_TRACK_HEIGHT = 160;

export default function MediaStudioScreen() {
  const insets = useSafeAreaInsets();
  const { isConnected, setVolume, toggleMute, getAudioStatus, sendKeyTap } = useAgentWS();

  const [volume, setVolumeState] = useState<number>(50);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [vuJitterL, setVuJitterL] = useState<number>(0);
  const [vuJitterR, setVuJitterR] = useState<number>(0);
  const [seekMode, setSeekMode] = useState<'web' | 'player'>('web');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Mutable refs for fluid gesture tracking and throttling
  const volumeRef = useRef<number>(50);
  const startVolumeRef = useRef<number>(50);
  const lastSendTimeRef = useRef<number>(0);

  // Keep volumeRef in sync
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Animations
  const busPulse = useRef(new Animated.Value(0.4)).current;
  const playScale = useRef(new Animated.Value(1)).current;
  const prevScale = useRef(new Animated.Value(1)).current;
  const nextScale = useRef(new Animated.Value(1)).current;
  const rewindScale = useRef(new Animated.Value(1)).current;
  const forwardScale = useRef(new Animated.Value(1)).current;
  const muteScale = useRef(new Animated.Value(1)).current;

  // D-Pad Animations
  const dpadUpScale = useRef(new Animated.Value(1)).current;
  const dpadDownScale = useRef(new Animated.Value(1)).current;
  const dpadLeftScale = useRef(new Animated.Value(1)).current;
  const dpadRightScale = useRef(new Animated.Value(1)).current;
  const dpadOkScale = useRef(new Animated.Value(1)).current;

  // Pulse animation for bus header
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

  // Sync initial volume state from agent
  useEffect(() => {
    if (isConnected) {
      getAudioStatus()
        .then((status) => {
          if (status) {
            setVolumeState(status.level);
            volumeRef.current = status.level;
            setIsMuted(status.muted);
          }
        })
        .catch(() => undefined);
    }
  }, [isConnected, getAudioStatus]);

  // Dynamic Dancing VU Meter simulation
  useEffect(() => {
    if (volume === 0 || isMuted) {
      setVuJitterL(0);
      setVuJitterR(0);
      return;
    }

    const interval = setInterval(() => {
      const jL = (Math.random() - 0.45) * 14;
      const jR = (Math.random() - 0.45) * 14;
      setVuJitterL(jL);
      setVuJitterR(jR);
    }, 140);

    return () => clearInterval(interval);
  }, [volume, isMuted]);

  // Buttery Smooth Volume Pan Responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        startVolumeRef.current = volumeRef.current;
        setIsDragging(true);
      },

      onPanResponderMove: (evt, gestureState) => {
        // Moving finger UP (-dy) increases volume; moving DOWN (+dy) decreases volume.
        const deltaPercent = -(gestureState.dy / FADER_TRACK_HEIGHT) * 100;
        const target = Math.max(0, Math.min(100, Math.round(startVolumeRef.current + deltaPercent)));

        setVolumeState(target);
        volumeRef.current = target;

        // Throttle WebSocket updates to 90ms during continuous drag
        const now = Date.now();
        if (now - lastSendTimeRef.current > 90) {
          lastSendTimeRef.current = now;
          setVolume(target).catch(() => undefined);
        }
      },

      onPanResponderRelease: () => {
        setIsDragging(false);
        const finalVol = volumeRef.current;
        lastSendTimeRef.current = Date.now();
        setVolume(finalVol).catch(() => undefined);
      },

      onPanResponderTerminate: () => {
        setIsDragging(false);
        const finalVol = volumeRef.current;
        lastSendTimeRef.current = Date.now();
        setVolume(finalVol).catch(() => undefined);
      },
    })
  ).current;

  const handleToggleMute = () => {
    Animated.sequence([
      Animated.timing(muteScale, { toValue: 0.92, duration: 70, useNativeDriver: true }),
      Animated.spring(muteScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    toggleMute()
      .then(() => setIsMuted(!isMuted))
      .catch(() => undefined);
  };

  const handleQuickVolume = (val: number) => {
    setVolumeState(val);
    volumeRef.current = val;
    setVolume(val).catch(() => undefined);
  };

  const pressSpring = (anim: Animated.Value, action: () => void) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    action();
  };

  // 10s Rewind: 'j' in Web/YouTube mode, Left Arrow in player mode
  const handleRewind10s = () => {
    pressSpring(rewindScale, () => {
      if (seekMode === 'web') {
        sendKeyTap('j');
      } else {
        sendKeyTap('left');
      }
    });
  };

  // 10s Fast-Forward: 'l' in Web/YouTube mode, Right Arrow in player mode
  const handleFastForward10s = () => {
    pressSpring(forwardScale, () => {
      if (seekMode === 'web') {
        sendKeyTap('l');
      } else {
        sendKeyTap('right');
      }
    });
  };

  // Convert volume percent (0-100) to approximate dBFS
  const dbfs = volume === 0 ? '-inf' : ((volume - 100) * 0.4).toFixed(1);

  // Dynamic effective meter level
  const effectiveVolL = Math.max(0, Math.min(100, volume + vuJitterL));
  const effectiveVolR = Math.max(0, Math.min(100, volume + vuJitterR));

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}
      contentContainerStyle={styles.content}
    >
      {/* Top Bus Header */}
      <View style={styles.busHeader}>
        <View style={styles.busHeaderTop}>
          <View style={styles.busTagRow}>
            <Animated.View style={[styles.dotPulse, { opacity: busPulse }]} />
            <Text style={styles.busTitle}>// MASTER_AUDIO_BUS</Text>
          </View>
          <View style={styles.latencyBadge}>
            <MaterialCommunityIcons name="tune" size={12} color="#CAF300" />
            <Text style={styles.latencyText}>WASAPI DIRECT</Text>
          </View>
        </View>

        <View style={styles.deviceRow}>
          <MaterialCommunityIcons name="equalizer" size={14} color="#CAF300" />
          <Text style={styles.deviceName} numberOfLines={1}>
            WINDOWS CORE AUDIO // 24-BIT MASTER
          </Text>
          <Text style={styles.lockBadge}>ACTIVE</Text>
        </View>
      </View>

      {/* Main Console Deck: VU Meter & Soundboard Master Fader */}
      <View style={styles.consoleDeck}>
        <View style={styles.deckHeader}>
          <Text style={styles.deckTitle}>ANALOG STAGE // DECK 01</Text>
          <Text style={styles.dbText}>LEVEL: {dbfs} dBFS</Text>
        </View>

        <View style={styles.mixerRow}>
          {/* Stereo VU Meter Dynamic Dancing Simulation */}
          <View style={styles.vuMeterBox}>
            <View style={styles.vuLabelRow}>
              <Text style={styles.vuLabel}>L CH</Text>
              <Text style={styles.vuLabel}>VU</Text>
              <Text style={styles.vuLabel}>R CH</Text>
            </View>

            <View style={styles.vuBarsRow}>
              {/* Left Channel */}
              <View style={styles.meterColumn}>
                {Array.from({ length: 18 }).map((_, i) => {
                  const threshold = (18 - i) * 5.5;
                  const active = effectiveVolL >= threshold;
                  const isRed = i < 3;
                  const isYellow = i >= 3 && i < 7;
                  return (
                    <View
                      key={`l_${i}`}
                      style={[
                        styles.meterSegment,
                        active && (isRed ? styles.segRed : isYellow ? styles.segYellow : styles.segGreen),
                      ]}
                    />
                  );
                })}
              </View>

              {/* dB Markers */}
              <View style={styles.markerColumn}>
                {['0', '-6', '-12', '-18', '-30', '-inf'].map((m) => (
                  <Text key={m} style={styles.markerText}>{m}</Text>
                ))}
              </View>

              {/* Right Channel */}
              <View style={styles.meterColumn}>
                {Array.from({ length: 18 }).map((_, i) => {
                  const threshold = (18 - i) * 5.5;
                  const active = effectiveVolR >= threshold;
                  const isRed = i < 3;
                  const isYellow = i >= 3 && i < 7;
                  return (
                    <View
                      key={`r_${i}`}
                      style={[
                        styles.meterSegment,
                        active && (isRed ? styles.segRed : isYellow ? styles.segYellow : styles.segGreen),
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* SOUNDBOARD FADER PANEL (Snd-Fader-Panel)                   */}
          {/* ========================================================= */}
          <View style={styles.sndFaderPanel}>
            <View style={styles.sndFaderHeaderRow}>
              <Text style={styles.sndFaderLabel}>VOL 01</Text>
              <Text style={styles.sndFaderValue}>{volume}%</Text>
            </View>

            {/* Track Area & Spatial Tick Mark Layout */}
            <View style={styles.sndFaderContainer} {...panResponder.panHandlers}>
              {/* Left Spatial Tick Marks */}
              <View style={styles.tickColumn}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <View key={`tl_${i}`} style={styles.tickMark} />
                ))}
              </View>

              {/* Center Deep Groove Track */}
              <View style={styles.sndAudioTrack}>
                <View style={[styles.sndTrackFill, { height: `${volume}%` }]} />
              </View>

              {/* Right Spatial Tick Marks */}
              <View style={styles.tickColumn}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <View key={`tr_${i}`} style={styles.tickMark} />
                ))}
              </View>

              {/* Custom Console Fader Knob with Red Indicator Stripe */}
              <Animated.View
                style={[
                  styles.sndFaderThumb,
                  {
                    bottom: `${Math.max(0, Math.min(88, volume * 0.88))}%`,
                    transform: [{ scale: isDragging ? 1.06 : 1.0 }],
                  },
                ]}
              >
                <View style={styles.thumbFlankLeft} />
                <View style={styles.thumbGrooveLeft} />
                {/* Center Red Indicator Stripe */}
                <View style={styles.thumbCenterLine} />
                <View style={styles.thumbGrooveRight} />
                <View style={styles.thumbFlankRight} />
              </Animated.View>
            </View>

            <Text style={styles.sndFaderHelp}>SLIDE TO ADJUST</Text>
          </View>
        </View>

        {/* Quick Level Snap Buttons */}
        <View style={styles.quickLevelsRow}>
          {[0, 25, 50, 75, 100].map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[styles.quickLvlBtn, volume === lvl && styles.quickLvlBtnActive]}
              onPress={() => handleQuickVolume(lvl)}
            >
              <Text style={[styles.quickLvlText, volume === lvl && styles.quickLvlTextActive]}>
                {lvl}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ========================================================= */}
      {/* TACTICAL TV REMOTE CARD                                   */}
      {/* ========================================================= */}
      <View style={styles.tvRemoteCard}>
        {/* Remote Header */}
        <View style={styles.remoteHeader}>
          <View style={styles.remoteTagRow}>
            <View style={styles.remoteLed} />
            <Text style={styles.remoteTitle}>TACTICAL TV REMOTE</Text>
          </View>
          <View style={styles.irBadge}>
            <MaterialCommunityIcons name="remote" size={14} color="#CAF300" />
            <Text style={styles.irText}>IR DIRECT</Text>
          </View>
        </View>

        {/* Seek Target Mode Selector */}
        <View style={styles.seekModeBox}>
          <Text style={styles.seekModeLabel}>10S SEEK MODE:</Text>
          <View style={styles.seekModePills}>
            <TouchableOpacity
              style={[styles.seekPill, seekMode === 'web' && styles.seekPillActive]}
              onPress={() => setSeekMode('web')}
            >
              <Text style={[styles.seekPillText, seekMode === 'web' && styles.seekPillTextActive]}>
                WEB / YOUTUBE (J / L)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.seekPill, seekMode === 'player' && styles.seekPillActive]}
              onPress={() => setSeekMode('player')}
            >
              <Text style={[styles.seekPillText, seekMode === 'player' && styles.seekPillTextActive]}>
                PLAYER (ARROWS)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top TV Remote Function Keys: Mute, Fullscreen, Esc/Back, Win */}
        <View style={styles.remoteTopFunctions}>
          {/* Mute Toggle */}
          <Animated.View style={{ flex: 1, transform: [{ scale: muteScale }] }}>
            <TouchableOpacity
              style={[styles.remoteFuncBtn, isMuted && styles.remoteFuncBtnMuted]}
              activeOpacity={0.8}
              onPress={handleToggleMute}
            >
              <MaterialCommunityIcons
                name={isMuted ? "volume-variant-off" : "volume-high"}
                size={20}
                color={isMuted ? "#EF4444" : "#CAF300"}
              />
              <Text style={[styles.remoteFuncLabel, isMuted && styles.remoteFuncLabelMuted]}>
                {isMuted ? 'UNMUTE' : 'MUTE'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Fullscreen (F) */}
          <TouchableOpacity
            style={styles.remoteFuncBtn}
            activeOpacity={0.8}
            onPress={() => sendKeyTap('f')}
          >
            <MaterialCommunityIcons name="fullscreen" size={20} color="#38BDF8" />
            <Text style={styles.remoteFuncLabel}>FULL</Text>
          </TouchableOpacity>

          {/* Back / Esc */}
          <TouchableOpacity
            style={styles.remoteFuncBtn}
            activeOpacity={0.8}
            onPress={() => sendKeyTap('esc')}
          >
            <MaterialCommunityIcons name="keyboard-backspace" size={20} color="#F1F5F9" />
            <Text style={styles.remoteFuncLabel}>BACK</Text>
          </TouchableOpacity>

          {/* Windows / Home */}
          <TouchableOpacity
            style={styles.remoteFuncBtn}
            activeOpacity={0.8}
            onPress={() => sendKeyTap('win')}
          >
            <MaterialCommunityIcons name="microsoft-windows" size={20} color="#F59E0B" />
            <Text style={styles.remoteFuncLabel}>HOME</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* CIRCULAR TV REMOTE D-PAD                                  */}
        {/* ========================================================= */}
        <View style={styles.dpadOuter}>
          <View style={styles.dpadCross}>
            {/* UP BUTTON */}
            <Animated.View style={[styles.dpadUpWrapper, { transform: [{ scale: dpadUpScale }] }]}>
              <TouchableOpacity
                style={styles.dpadBtn}
                activeOpacity={0.7}
                onPress={() => pressSpring(dpadUpScale, () => sendKeyTap('up'))}
              >
                <MaterialCommunityIcons name="chevron-up" size={28} color="#CAF300" />
                <Text style={styles.dpadDirLabel}>UP</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* MIDDLE ROW: LEFT, CENTER OK, RIGHT */}
            <View style={styles.dpadMiddleRow}>
              {/* LEFT BUTTON */}
              <Animated.View style={[styles.dpadBtnWrapper, { transform: [{ scale: dpadLeftScale }] }]}>
                <TouchableOpacity
                  style={styles.dpadBtn}
                  activeOpacity={0.7}
                  onPress={() => pressSpring(dpadLeftScale, () => sendKeyTap('left'))}
                >
                  <MaterialCommunityIcons name="chevron-left" size={28} color="#CAF300" />
                  <Text style={styles.dpadDirLabel}>LEFT</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* CENTER OK BUTTON */}
              <Animated.View style={[styles.dpadOkWrapper, { transform: [{ scale: dpadOkScale }] }]}>
                <TouchableOpacity
                  style={styles.dpadOkBtn}
                  activeOpacity={0.75}
                  onPress={() => pressSpring(dpadOkScale, () => sendKeyTap('enter'))}
                >
                  <Text style={styles.dpadOkText}>OK</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* RIGHT BUTTON */}
              <Animated.View style={[styles.dpadBtnWrapper, { transform: [{ scale: dpadRightScale }] }]}>
                <TouchableOpacity
                  style={styles.dpadBtn}
                  activeOpacity={0.7}
                  onPress={() => pressSpring(dpadRightScale, () => sendKeyTap('right'))}
                >
                  <MaterialCommunityIcons name="chevron-right" size={28} color="#CAF300" />
                  <Text style={styles.dpadDirLabel}>RIGHT</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* DOWN BUTTON */}
            <Animated.View style={[styles.dpadDownWrapper, { transform: [{ scale: dpadDownScale }] }]}>
              <TouchableOpacity
                style={styles.dpadBtn}
                activeOpacity={0.7}
                onPress={() => pressSpring(dpadDownScale, () => sendKeyTap('down'))}
              >
                <Text style={styles.dpadDirLabel}>DOWN</Text>
                <MaterialCommunityIcons name="chevron-down" size={28} color="#CAF300" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* MEDIA PLAYBACK WITH 10S FAST-FORWARD & PREVIOUS           */}
        {/* ========================================================= */}
        <View style={styles.playbackSection}>
          <Text style={styles.sectionMiniTitle}>PLAYBACK CONTROLS</Text>
          <View style={styles.playbackControlsRow}>
            {/* 1. Previous Track */}
            <Animated.View style={{ flex: 1, transform: [{ scale: prevScale }] }}>
              <TouchableOpacity
                style={styles.playbackBtn}
                activeOpacity={0.8}
                onPress={() => pressSpring(prevScale, () => sendKeyTap('media_prev'))}
              >
                <MaterialCommunityIcons name="skip-previous" size={22} color="#F1F5F9" />
                <Text style={styles.playbackBtnLabel}>PREV</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 2. 10s Rewind Jump */}
            <Animated.View style={{ flex: 1.1, transform: [{ scale: rewindScale }] }}>
              <TouchableOpacity
                style={[styles.playbackBtn, styles.seekJumpBtn]}
                activeOpacity={0.8}
                onPress={handleRewind10s}
              >
                <MaterialCommunityIcons name="rewind-10" size={24} color="#38BDF8" />
                <Text style={[styles.playbackBtnLabel, styles.seekJumpLabel]}>-10s</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 3. Play / Pause (Large Central Action Button) */}
            <Animated.View style={{ flex: 1.4, transform: [{ scale: playScale }] }}>
              <TouchableOpacity
                style={[styles.playbackBtn, styles.playPauseBtn]}
                activeOpacity={0.8}
                onPress={() => pressSpring(playScale, () => sendKeyTap('media_play_pause'))}
              >
                <MaterialCommunityIcons name="play-pause" size={28} color="#000000" />
                <Text style={styles.playPauseLabel}>PLAY/PAUSE</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 4. 10s Fast Forward Jump */}
            <Animated.View style={{ flex: 1.1, transform: [{ scale: forwardScale }] }}>
              <TouchableOpacity
                style={[styles.playbackBtn, styles.seekJumpBtn]}
                activeOpacity={0.8}
                onPress={handleFastForward10s}
              >
                <MaterialCommunityIcons name="fast-forward-10" size={24} color="#38BDF8" />
                <Text style={[styles.playbackBtnLabel, styles.seekJumpLabel]}>+10s</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 5. Next Track */}
            <Animated.View style={{ flex: 1, transform: [{ scale: nextScale }] }}>
              <TouchableOpacity
                style={styles.playbackBtn}
                activeOpacity={0.8}
                onPress={() => pressSpring(nextScale, () => sendKeyTap('media_next'))}
              >
                <MaterialCommunityIcons name="skip-next" size={22} color="#F1F5F9" />
                <Text style={styles.playbackBtnLabel}>NEXT</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* DUAL ROCKERS: VOLUME +/- AND PAGE UP/DOWN                 */}
        {/* ========================================================= */}
        <View style={styles.rockersRow}>
          {/* Volume Rocker */}
          <View style={styles.rockerCard}>
            <Text style={styles.rockerTitle}>VOLUME</Text>
            <View style={styles.rockerBtnCol}>
              <TouchableOpacity
                style={styles.rockerBtn}
                activeOpacity={0.7}
                onPress={() => sendKeyTap('volume_up')}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#CAF300" />
                <Text style={styles.rockerBtnText}>VOL +</Text>
              </TouchableOpacity>

              <View style={styles.rockerDivider} />

              <TouchableOpacity
                style={styles.rockerBtn}
                activeOpacity={0.7}
                onPress={() => sendKeyTap('volume_down')}
              >
                <MaterialCommunityIcons name="minus" size={18} color="#CAF300" />
                <Text style={styles.rockerBtnText}>VOL -</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Page / Channel Rocker */}
          <View style={styles.rockerCard}>
            <Text style={styles.rockerTitle}>SCROLL / PAGE</Text>
            <View style={styles.rockerBtnCol}>
              <TouchableOpacity
                style={styles.rockerBtn}
                activeOpacity={0.7}
                onPress={() => sendKeyTap('pageup')}
              >
                <MaterialCommunityIcons name="chevron-double-up" size={18} color="#F1F5F9" />
                <Text style={styles.rockerBtnText}>PAGE UP</Text>
              </TouchableOpacity>

              <View style={styles.rockerDivider} />

              <TouchableOpacity
                style={styles.rockerBtn}
                activeOpacity={0.7}
                onPress={() => sendKeyTap('pagedown')}
              >
                <MaterialCommunityIcons name="chevron-double-down" size={18} color="#F1F5F9" />
                <Text style={styles.rockerBtnText}>PAGE DN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 28,
    gap: 12,
  },
  busHeader: {
    backgroundColor: '#10141D',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 8,
  },
  busHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  busTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CAF300',
  },
  busTitle: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  latencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  latencyText: {
    color: '#CAF300',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#090C12',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deviceName: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  lockBadge: {
    color: '#CAF300',
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: '#17202A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  consoleDeck: {
    backgroundColor: '#10141D',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 12,
  },
  deckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deckTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  dbText: {
    color: '#CAF300',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  mixerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  vuMeterBox: {
    flex: 1,
    backgroundColor: '#090C12',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1A202C',
  },
  vuLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vuLabel: {
    color: '#475569',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  vuBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterColumn: {
    flex: 1,
    gap: 3,
  },
  meterSegment: {
    height: 5,
    backgroundColor: '#141A24',
    borderRadius: 1,
  },
  segGreen: {
    backgroundColor: '#CAF300',
  },
  segYellow: {
    backgroundColor: '#F59E0B',
  },
  segRed: {
    backgroundColor: '#EF4444',
  },
  markerColumn: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  markerText: {
    color: '#334155',
    fontSize: 8,
    fontFamily: Platform.select({ default: 'monospace' }),
  },

  /* SOUNDBOARD FADER PANEL (snd-fader-panel) */
  sndFaderPanel: {
    flex: 1.25,
    backgroundColor: '#1E1E24',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#151518',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  sndFaderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sndFaderLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  sndFaderValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  sndFaderContainer: {
    position: 'relative',
    height: 160,
    width: 80,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickColumn: {
    height: 150,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  tickMark: {
    width: 10,
    height: 2,
    backgroundColor: '#44444C',
    borderRadius: 1,
  },
  sndAudioTrack: {
    width: 8,
    height: 150,
    backgroundColor: '#0D0D10',
    borderRadius: 4,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#151518',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  sndTrackFill: {
    width: '100%',
    backgroundColor: '#CAF300',
    borderRadius: 3,
  },
  /* SOUNDBOARD KNOB (BRUSHED METAL WITH RED CENTER STRIPE) */
  sndFaderThumb: {
    position: 'absolute',
    width: 44,
    height: 24,
    borderRadius: 3,
    backgroundColor: '#3A3A42',
    borderWidth: 1,
    borderColor: '#111114',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  thumbFlankLeft: {
    flex: 1,
    height: '100%',
    backgroundColor: '#555560',
  },
  thumbGrooveLeft: {
    width: 3,
    height: '100%',
    backgroundColor: '#1A1A1F',
  },
  thumbCenterLine: {
    width: 3,
    height: '100%',
    backgroundColor: '#D12B2B',
  },
  thumbGrooveRight: {
    width: 3,
    height: '100%',
    backgroundColor: '#1A1A1F',
  },
  thumbFlankRight: {
    flex: 1,
    height: '100%',
    backgroundColor: '#555560',
  },
  sndFaderHelp: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
    marginTop: 8,
  },

  quickLevelsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickLvlBtn: {
    flex: 1,
    backgroundColor: '#131822',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2538',
  },
  quickLvlBtnActive: {
    backgroundColor: '#CAF300',
  },
  quickLvlText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  quickLvlTextActive: {
    color: '#000000',
  },

  /* TV REMOTE CARD STYLING */
  tvRemoteCard: {
    backgroundColor: '#10141D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  remoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remoteTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  remoteLed: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#CAF300',
    shadowColor: '#CAF300',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  remoteTitle: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  irBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#243048',
  },
  irText: {
    color: '#CAF300',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  seekModeBox: {
    backgroundColor: '#090C12',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#19202E',
    gap: 6,
  },
  seekModeLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  seekModePills: {
    flexDirection: 'row',
    gap: 6,
  },
  seekPill: {
    flex: 1,
    backgroundColor: '#131924',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F293D',
  },
  seekPillActive: {
    backgroundColor: '#1E293B',
    borderColor: '#CAF300',
  },
  seekPillText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  seekPillTextActive: {
    color: '#CAF300',
  },
  remoteTopFunctions: {
    flexDirection: 'row',
    gap: 8,
  },
  remoteFuncBtn: {
    flex: 1,
    backgroundColor: '#161D2B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#243048',
    gap: 4,
  },
  remoteFuncBtnMuted: {
    backgroundColor: '#3B1219',
    borderColor: '#7F1D1D',
  },
  remoteFuncLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  remoteFuncLabelMuted: {
    color: '#EF4444',
  },

  /* CIRCULAR D-PAD STYLING */
  dpadOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dpadCross: {
    width: 220,
    height: 220,
    backgroundColor: '#090C12',
    borderRadius: 110,
    borderWidth: 2,
    borderColor: '#1E2538',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  dpadUpWrapper: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
  },
  dpadDownWrapper: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
  },
  dpadBtnWrapper: {
    width: 58,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadBtn: {
    width: 54,
    height: 54,
    backgroundColor: '#131924',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#243048',
  },
  dpadDirLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  dpadOkWrapper: {
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadOkBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#CAF300',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#CAF300',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  dpadOkText: {
    color: '#CAF300',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Platform.select({ default: 'monospace' }),
  },

  /* PLAYBACK SECTION STYLING */
  playbackSection: {
    gap: 8,
  },
  sectionMiniTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
  playbackControlsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  playbackBtn: {
    width: '100%',
    backgroundColor: '#161D2B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#243048',
    gap: 3,
  },
  seekJumpBtn: {
    backgroundColor: '#0F1E2E',
    borderColor: '#1E3A5F',
  },
  playPauseBtn: {
    backgroundColor: '#CAF300',
    borderColor: '#CAF300',
  },
  playbackBtnLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  seekJumpLabel: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  playPauseLabel: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Platform.select({ default: 'monospace' }),
  },

  /* ROCKERS ROW */
  rockersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rockerCard: {
    flex: 1,
    backgroundColor: '#090C12',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#19202E',
    gap: 8,
  },
  rockerTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  rockerBtnCol: {
    backgroundColor: '#131924',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#243048',
    overflow: 'hidden',
  },
  rockerBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  rockerDivider: {
    height: 1,
    backgroundColor: '#1E2538',
  },
  rockerBtnText: {
    color: '#F1F5F9',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
});

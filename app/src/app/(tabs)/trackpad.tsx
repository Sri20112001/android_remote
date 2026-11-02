import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgentWS } from '@/api/use-agent-ws';

export default function TrackpadScreen() {
  const insets = useSafeAreaInsets();
  const {
    isConnected,
    connectionState,
    sendMouseMove,
    sendMouseClick,
    sendMouseScroll,
    sendKeyTap,
    sendTypeText,
  } = useAgentWS();

  const [sensitivity, setSensitivity] = useState<number>(1.0);
  const [showKeyboard, setShowKeyboard] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');

  // Animations & Native Drivers
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const touchPos = useRef(new Animated.ValueXY({ x: -100, y: -100 })).current;
  const touchScale = useRef(new Animated.Value(0.3)).current;
  const touchOpacity = useRef(new Animated.Value(0)).current;
  const leftScale = useRef(new Animated.Value(1)).current;
  const rightScale = useRef(new Animated.Value(1)).current;
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const accumX = useRef<number>(0);
  const accumY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const touchMoved = useRef<boolean>(false);

  // Pulse animation for TUF-Link indicator
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Keyboard drawer slide animation
  useEffect(() => {
    Animated.spring(keyboardAnim, {
      toValue: showKeyboard ? 1 : 0,
      tension: 65,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [showKeyboard, keyboardAnim]);

  const triggerTouchRipple = (x: number, y: number) => {
    touchPos.setValue({ x: x - 30, y: y - 30 });
    touchScale.setValue(0.3);
    touchOpacity.setValue(0.9);
    Animated.parallel([
      Animated.timing(touchScale, {
        toValue: 1.8,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(touchOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
        lastPos.current = { x: pageX, y: pageY };
        accumX.current = 0;
        accumY.current = 0;
        touchStartTime.current = Date.now();
        touchMoved.current = false;
        triggerTouchRipple(locationX, locationY);
      },

      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { touches, pageX, pageY } = evt.nativeEvent;

        const rawDx = (pageX - lastPos.current.x) * sensitivity * 1.6;
        const rawDy = (pageY - lastPos.current.y) * sensitivity * 1.6;

        lastPos.current = { x: pageX, y: pageY };

        accumX.current += rawDx;
        accumY.current += rawDy;

        const stepX = Math.trunc(accumX.current);
        const stepY = Math.trunc(accumY.current);

        if (stepX !== 0 || stepY !== 0) {
          accumX.current -= stepX;
          accumY.current -= stepY;
          touchMoved.current = true;

          if (touches.length === 2) {
            // Two-finger scroll
            sendMouseScroll(-stepY * 3);
          } else {
            // One-finger cursor move
            sendMouseMove(stepX, stepY);
          }
        }
      },

      onPanResponderRelease: (evt: GestureResponderEvent) => {
        const elapsed = Date.now() - touchStartTime.current;

        // If tap without significant movement in < 280ms -> Left Click!
        if (!touchMoved.current && elapsed < 280) {
          sendMouseClick('left');
          // Rapid button pulse animation
          Animated.sequence([
            Animated.timing(leftScale, { toValue: 0.94, duration: 60, useNativeDriver: true }),
            Animated.spring(leftScale, { toValue: 1, friction: 4, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const handleSendText = () => {
    if (inputText.length > 0) {
      sendTypeText(inputText);
      setInputText('');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* Top Tactical Status Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.statusDotRow}>
            <Animated.View
              style={[
                styles.dot,
                isConnected ? styles.dotActive : styles.dotOffline,
                { opacity: isConnected ? pulseAnim : 1 },
              ]}
            />
            <Text style={styles.statusText}>
              {isConnected ? 'TUF-LINK ACTIVE' : connectionState.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.subStatusText}>OBSIDIAN GLASS // KINETIC MATRIX</Text>
        </View>

        {/* Sensitivity Switcher */}
        <View style={styles.sensRow}>
          {[
            { label: '0.5x', val: 0.5 },
            { label: '1.0x', val: 1.0 },
            { label: '2.5x', val: 2.5 },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => setSensitivity(item.val)}
              style={[
                styles.sensChip,
                sensitivity === item.val && styles.sensChipActive,
              ]}
            >
              <Text
                style={[
                  styles.sensText,
                  sensitivity === item.val && styles.sensTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.keybdToggle, showKeyboard && styles.keybdToggleActive]}
            onPress={() => setShowKeyboard(!showKeyboard)}
          >
            <MaterialCommunityIcons
              name="keyboard-outline"
              size={18}
              color={showKeyboard ? '#000' : '#CAF300'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Animated Virtual Keyboard Stream Drawer */}
      {showKeyboard && (
        <Animated.View
          style={[
            styles.keyboardDrawer,
            {
              opacity: keyboardAnim,
              transform: [
                {
                  translateY: keyboardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Stream text to Windows PC..."
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
              autoFocus
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendText}>
              <Text style={styles.sendBtnText}>SEND</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Keys */}
          <View style={styles.quickKeysRow}>
            {[
              { label: 'ESC', key: 'esc' },
              { label: 'TAB', key: 'tab' },
              { label: 'ENTER', key: 'enter' },
              { label: 'BKSP', key: 'backspace' },
              { label: 'SPACE', key: 'space' },
              { label: 'WIN', key: 'win' },
            ].map((k) => (
              <TouchableOpacity
                key={k.label}
                style={styles.keyBtn}
                onPress={() => sendKeyTap(k.key)}
              >
                <Text style={styles.keyBtnText}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Main Kinetic Trackpad Surface Frame */}
      <View style={styles.trackpadWrapper}>
        <View style={styles.touchSurface} {...panResponder.panHandlers}>
          {/* Animated Neon Ripple Effect (Native GPU Accelerated) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rippleRing,
              {
                opacity: touchOpacity,
                transform: [
                  { translateX: touchPos.x },
                  { translateY: touchPos.y },
                  { scale: touchScale },
                ],
              },
            ]}
          />

          {/* Laser-Etched Reticles */}
          <View style={styles.cornerTL}>
            <Text style={styles.reticleText}>+ [TL-00]</Text>
          </View>
          <View style={styles.cornerTR}>
            <Text style={styles.reticleText}>[TR-01] +</Text>
          </View>
          <View style={styles.cornerBL}>
            <Text style={styles.reticleText}>+ [BL-10]</Text>
          </View>
          <View style={styles.cornerBR}>
            <Text style={styles.reticleText}>[BR-11] +</Text>
          </View>

          {/* Center Crosshair */}
          <View style={styles.centerCross}>
            <View style={styles.crossH} />
            <View style={styles.crossV} />
          </View>

          <View style={styles.surfaceHint}>
            <Text style={styles.hintTitle}>KINETIC TOUCH SURFACE</Text>
            <Text style={styles.hintSub}>
              1-Finger: Move &bull; 1-Tap: Left Click &bull; 2-Finger: Scroll
            </Text>
          </View>
        </View>
      </View>

      {/* Tactile Spring Click Triggers */}
      <View style={styles.clickBar}>
        <Animated.View style={{ flex: 1.2, transform: [{ scale: leftScale }] }}>
          <TouchableOpacity
            style={[styles.clickBtn, styles.leftClickBtn]}
            activeOpacity={0.9}
            onPressIn={() =>
              Animated.spring(leftScale, { toValue: 0.93, useNativeDriver: true }).start()
            }
            onPressOut={() =>
              Animated.spring(leftScale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
            }
            onPress={() => sendMouseClick('left')}
          >
            <MaterialCommunityIcons name="mouse-left-click" size={20} color="#CAF300" />
            <Text style={styles.clickBtnText}>LEFT CLICK</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ flex: 1, transform: [{ scale: rightScale }] }}>
          <TouchableOpacity
            style={[styles.clickBtn, styles.rightClickBtn]}
            activeOpacity={0.9}
            onPressIn={() =>
              Animated.spring(rightScale, { toValue: 0.93, useNativeDriver: true }).start()
            }
            onPressOut={() =>
              Animated.spring(rightScale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
            }
            onPress={() => sendMouseClick('right')}
          >
            <MaterialCommunityIcons name="mouse-right-click" size={20} color="#CAF300" />
            <Text style={styles.clickBtnText}>RIGHT CLICK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A202C',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#CAF300',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
  subStatusText: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
    marginTop: 2,
  },
  sensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sensChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  sensChipActive: {
    backgroundColor: '#CAF300',
  },
  sensText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  sensTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  keybdToggle: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  keybdToggleActive: {
    backgroundColor: '#CAF300',
  },
  keyboardDrawer: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0B0E14',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sendBtn: {
    backgroundColor: '#CAF300',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 12,
  },
  quickKeysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  keyBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  keyBtnText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  trackpadWrapper: {
    flex: 1,
    backgroundColor: '#101319',
    borderRadius: 16,
    marginVertical: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1E2430',
    overflow: 'hidden',
  },
  touchSurface: {
    flex: 1,
    backgroundColor: '#0D1117',
    borderRadius: 14,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#CAF300',
    backgroundColor: 'rgba(202, 243, 0, 0.15)',
  },
  cornerTL: { position: 'absolute', top: 12, left: 12 },
  cornerTR: { position: 'absolute', top: 12, right: 12 },
  cornerBL: { position: 'absolute', bottom: 12, left: 12 },
  cornerBR: { position: 'absolute', bottom: 12, right: 12 },
  reticleText: {
    color: '#334155',
    fontSize: 10,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  centerCross: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.15,
  },
  crossH: {
    position: 'absolute',
    width: 24,
    height: 1,
    backgroundColor: '#CAF300',
  },
  crossV: {
    position: 'absolute',
    width: 1,
    height: 24,
    backgroundColor: '#CAF300',
  },
  surfaceHint: {
    alignItems: 'center',
    opacity: 0.35,
  },
  hintTitle: {
    color: '#CAF300',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  hintSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  clickBar: {
    flexDirection: 'row',
    gap: 8,
    height: 64,
  },
  clickBtn: {
    flex: 1,
    backgroundColor: '#131822',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1E2538',
  },
  leftClickBtn: {
    width: '100%',
    height: '100%',
  },
  rightClickBtn: {
    width: '100%',
    height: '100%',
  },
  clickBtnText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
});

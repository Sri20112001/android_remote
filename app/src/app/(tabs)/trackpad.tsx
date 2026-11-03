import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Gyroscope } from 'expo-sensors';
import { useAgentWS } from '@/api/use-agent-ws';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { triggerHaptic } from '@/utils/haptics';
import { MacroDeck } from '@/components/macro-deck';

/**
 * The freshest values the gesture responders need.
 *
 * `PanResponder.create` runs once (inside `useState`) and its handlers are
 * built at that moment, so they would otherwise freeze whatever `sensitivity`
 * and `client` happened to be on the first render — the DPI buttons would do
 * nothing, and moves could be dispatched through a client that was still
 * null. Handlers read this holder at call time instead.
 *
 * A plain object rather than a ref or React state: refs may not be read from
 * a render-built closure, and React state may not be written to. Only one
 * trackpad screen is ever mounted, so sharing it is harmless.
 */
const latest: {
  sensitivity: number;
  sendMouseMove: (dx: number, dy: number) => void;
  sendMouseScroll: (dy: number) => void;
  sendMouseClick: (button?: 'left' | 'right' | 'middle', double?: boolean) => void;
  sendMouseDown: (button?: 'left' | 'right' | 'middle') => void;
  sendMouseUp: (button?: 'left' | 'right' | 'middle') => void;
} = {
  sensitivity: 1.0,
  sendMouseMove: () => {},
  sendMouseScroll: () => {},
  sendMouseClick: () => {},
  sendMouseDown: () => {},
  sendMouseUp: () => {},
};

/**
 * How long the finger must rest in place before the pad starts dragging.
 * Short enough to feel deliberate, long enough that a normal glide never
 * turns into an accidental drag.
 */
const HOLD_TO_DRAG_MS = 300;

/**
 * Windows reports wheel motion in multiples of WHEEL_DELTA (120). Most
 * applications integer-divide the incoming delta by 120, so anything smaller
 * is silently dropped — which is exactly why raw finger-pixel deltas
 * (values like 6 or 18) scrolled nothing at all.
 */
const WHEEL_DELTA = 120;

/** Finger travel is amplified by this much before it moves the cursor. */
const POINTER_GAIN = 1.6;

/** Finger pixels to wheel units: 20px of travel equals one 120-unit notch. */
const WHEEL_UNITS_PER_PX = 6;

export default function TrackpadScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const {
    isConnected,
    connectionState,
    sendMouseMove,
    sendMouseClick,
    sendMouseScroll,
    sendMouseDown,
    sendMouseUp,
    sendKeyTap,
    sendTypeText,
    getClipboard,
    setClipboard,
  } = useAgentWS();

  const [sensitivity, setSensitivity] = useState<number>(1.0);
  const [showKeyboard, setShowKeyboard] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [isAirMouseActive, setIsAirMouseActive] = useState<boolean>(false);
  const [showMacroDeck, setShowMacroDeck] = useState<boolean>(false);
  const [clipboardStatus, setClipboardStatus] = useState<string | null>(null);

  // Animation values
  const [pulseAnim] = useState(() => new Animated.Value(0.35));
  const [touchPos] = useState(() => new Animated.ValueXY({ x: -100, y: -100 }));
  const [touchScale] = useState(() => new Animated.Value(0.3));
  const [touchOpacity] = useState(() => new Animated.Value(0));
  const [leftScale] = useState(() => new Animated.Value(1));
  const [rightScale] = useState(() => new Animated.Value(1));
  const [middleScale] = useState(() => new Animated.Value(1));
  const [keyboardAnim] = useState(() => new Animated.Value(0));

  // Mutable gesture tracking
  const [gesture] = useState(() => ({
    lastPos: { x: 0, y: 0 },
    accumX: 0,
    accumY: 0,
    touchStartTime: 0,
    touchMoved: false,
    lastScrollY: 0,
    wheelMoved: false,
    wheelStartTime: 0,
    // One-finger moves are coalesced into a single frame per display frame.
    moveX: 0,
    moveY: 0,
    moveScheduled: false,
    // Press-and-hold drag: a timer that arms the left button once the finger
    // has been still for HOLD_TO_DRAG_MS, and the flag that says it fired.
    holdTimer: null as ReturnType<typeof setTimeout> | null,
    dragging: false,
    // Sub-notch wheel travel, carried between gestures so slow scrolling
    // eventually adds up to a whole 120-unit notch instead of being dropped.
    scrollRemainder: 0,
  }));

  // Point the responders at the current sensitivity and client. The effect
  // runs before the next touch can be handled, so handlers never see a stale
  // binding.
  useEffect(() => {
    latest.sensitivity = sensitivity;
    latest.sendMouseMove = sendMouseMove;
    latest.sendMouseScroll = sendMouseScroll;
    latest.sendMouseClick = sendMouseClick;
    latest.sendMouseDown = sendMouseDown;
    latest.sendMouseUp = sendMouseUp;
  }, [
    sensitivity,
    sendMouseMove,
    sendMouseScroll,
    sendMouseClick,
    sendMouseDown,
    sendMouseUp,
  ]);

  // Gyroscopic Air Mouse Engine
  useEffect(() => {
    if (!isAirMouseActive || !isConnected) return;
    Gyroscope.setUpdateInterval(25); // 40Hz update cadence
    const sub = Gyroscope.addListener(({ x, y, z }) => {
      const threshold = 0.07;
      let dx = 0;
      let dy = 0;
      if (Math.abs(z) > threshold) {
        dx = -z * 35 * sensitivity;
      }
      if (Math.abs(x) > threshold) {
        dy = -x * 35 * sensitivity;
      }
      if (dx !== 0 || dy !== 0) {
        sendMouseMove(dx, dy);
      }
    });
    return () => sub.remove();
  }, [isAirMouseActive, isConnected, sensitivity, sendMouseMove]);

  // Connection indicator pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Keyboard drawer animation
  useEffect(() => {
    Animated.spring(keyboardAnim, {
      toValue: showKeyboard ? 1 : 0,
      tension: 75,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [showKeyboard, keyboardAnim]);

  const triggerTouchRipple = (x: number, y: number) => {
    touchPos.setValue({ x: x - 28, y: y - 28 });
    touchScale.setValue(0.3);
    touchOpacity.setValue(0.85);
    Animated.parallel([
      Animated.timing(touchScale, { toValue: 2, duration: 300, useNativeDriver: true }),
      Animated.timing(touchOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  // ── Scroll: only whole notches ever leave the phone ────────────────────
  // Finger travel is notched up locally because Windows `MOUSEEVENTF_WHEEL`
  // expects whole WHEEL_DELTA units and most applications integer-divide by
  // 120 — anything smaller was being thrown away before it reached the PC.
  const queueScroll = (units: number) => {
    gesture.scrollRemainder += units;
    const notches = Math.trunc(gesture.scrollRemainder / WHEEL_DELTA);
    if (notches === 0) return;
    gesture.scrollRemainder -= notches * WHEEL_DELTA;
    latest.sendMouseScroll(notches * WHEEL_DELTA);
  };

  // ── Press-and-hold drag ───────────────────────────────────────────────
  // Arming is debounced on movement: the timer is restarted by every move, so
  // it only fires once the finger has actually stopped travelling. A glide
  // therefore never turns into a drag, while "glide, pause, pull" does.
  const cancelHoldDrag = () => {
    if (gesture.holdTimer !== null) {
      clearTimeout(gesture.holdTimer);
      gesture.holdTimer = null;
    }
  };

  const armHoldDrag = () => {
    cancelHoldDrag();
    gesture.holdTimer = setTimeout(() => {
      gesture.holdTimer = null;
      if (gesture.dragging) return;
      gesture.dragging = true;
      latest.sendMouseDown('left');
      triggerHaptic.medium();
    }, HOLD_TO_DRAG_MS);
  };

  /** Releases the left button if a drag is armed. Returns true if it was. */
  const endDrag = (): boolean => {
    cancelHoldDrag();
    if (!gesture.dragging) return false;
    gesture.dragging = false;
    latest.sendMouseUp('left');
    return true;
  };

  // Never leave the PC's left button held down if the screen goes away
  // mid-drag.
  useEffect(
    () => () => {
      if (gesture.dragging) latest.sendMouseUp('left');
      if (gesture.holdTimer !== null) clearTimeout(gesture.holdTimer);
    },
    [gesture]
  );

  // Mouse Body / Palm Rest Touchpad
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
        gesture.lastPos = { x: pageX, y: pageY };
        gesture.accumX = 0;
        gesture.accumY = 0;
        gesture.touchStartTime = Date.now();
        gesture.touchMoved = false;
        // Hold still to arm a drag; a tap or a glide cancels it before it fires.
        armHoldDrag();
        triggerTouchRipple(locationX, locationY);
      },

      onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
        const { touches, pageX, pageY } = evt.nativeEvent;

        // A second finger means scroll intent, not drag. Otherwise every move
        // re-arms the hold timer, so a drag only engages once the finger has
        // genuinely been still for HOLD_TO_DRAG_MS.
        if (touches.length >= 2) {
          if (!gesture.dragging) cancelHoldDrag();
        } else if (!gesture.dragging) {
          armHoldDrag();
        }

        const rawDx = (pageX - gesture.lastPos.x) * latest.sensitivity * POINTER_GAIN;
        const rawDy = (pageY - gesture.lastPos.y) * latest.sensitivity * POINTER_GAIN;

        gesture.lastPos = { x: pageX, y: pageY };
        gesture.accumX += rawDx;
        gesture.accumY += rawDy;

        const stepX = Math.trunc(gesture.accumX);
        const stepY = Math.trunc(gesture.accumY);

        if (stepX === 0 && stepY === 0) return;

        gesture.accumX -= stepX;
        gesture.accumY -= stepY;
        gesture.touchMoved = true;

        // Two-finger scroll: notched up to whole Windows wheel units.
        if (touches.length === 2) {
          queueScroll((-stepY * WHEEL_UNITS_PER_PX) / POINTER_GAIN);
          return;
        }

        // One-finger motion is the hot path: every event landing in the same
        // display frame is folded into one WebSocket frame instead of doing a
        // JSON.stringify + send per touch event.
        gesture.moveX += stepX;
        gesture.moveY += stepY;

        if (!gesture.moveScheduled) {
          gesture.moveScheduled = true;
          requestAnimationFrame(() => {
            gesture.moveScheduled = false;
            const dx = gesture.moveX;
            const dy = gesture.moveY;
            gesture.moveX = 0;
            gesture.moveY = 0;
            if (dx !== 0 || dy !== 0) {
              latest.sendMouseMove(dx, dy);
            }
          });
        }
      },

      onPanResponderRelease: () => {
        // Ship anything still buffered before letting go of the button, so the
        // last pixels of a drag land while the button is still down.
        const pendingX = gesture.moveX;
        const pendingY = gesture.moveY;
        if (pendingX !== 0 || pendingY !== 0) {
          gesture.moveX = 0;
          gesture.moveY = 0;
          latest.sendMouseMove(pendingX, pendingY);
        }

        if (endDrag()) return;

        const elapsed = Date.now() - gesture.touchStartTime;
        if (!gesture.touchMoved && elapsed < 250) {
          triggerHaptic.light();
          latest.sendMouseClick('left');
          Animated.sequence([
            Animated.timing(leftScale, { toValue: 0.94, duration: 40, useNativeDriver: true }),
            Animated.spring(leftScale, { toValue: 1, friction: 3, useNativeDriver: true }),
          ]).start();
        }
      },

      onPanResponderTerminate: () => {
        // The gesture was taken over (system nav, app switch): release the
        // button rather than leaving the PC dragging.
        endDrag();
      },
    })
  );

  // Physical Scroll Wheel (Drag up/down to scroll, Tap to Middle Click)
  const [wheelResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        gesture.lastScrollY = evt.nativeEvent.pageY;
        gesture.wheelMoved = false;
        gesture.wheelStartTime = Date.now();
        Animated.spring(middleScale, { toValue: 0.9, useNativeDriver: true }).start();
      },

      onPanResponderMove: (evt: GestureResponderEvent) => {
        const dy = evt.nativeEvent.pageY - gesture.lastScrollY;
        if (Math.abs(dy) > 3) {
          gesture.wheelMoved = true;
          queueScroll(-dy * WHEEL_UNITS_PER_PX);
          gesture.lastScrollY = evt.nativeEvent.pageY;
        }
      },

      onPanResponderRelease: () => {
        Animated.spring(middleScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        const elapsed = Date.now() - gesture.wheelStartTime;
        if (!gesture.wheelMoved && elapsed < 300) {
          triggerHaptic.heavy();
          latest.sendMouseClick('middle');
        }
      },
    })
  );

  const handleSendText = () => {
    if (inputText.trim().length > 0) {
      sendTypeText(inputText);
      setInputText('');
    }
  };

  return (
    <View
      className="flex-1 bg-[#04060A] px-3 justify-between"
      style={{
        paddingTop: Math.max(insets.top, 14),
        paddingBottom: tabBarClearance,
      }}
    >
      {/* ── Top HUD Status & Sensitivity Bar ── */}
      <View className="flex-row items-center justify-between pb-2.5 border-b border-zinc-800/80">
        <View className="flex-row items-center gap-3">
          <View className="relative justify-center items-center">
            <Animated.View
              className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#CAF300]' : 'bg-rose-500'}`}
              style={{ opacity: isConnected ? pulseAnim : 1 }}
            />
            {isConnected && (
              <View className="absolute w-4 h-4 rounded-full border border-[#CAF300]/40" />
            )}
          </View>

          <View>
            <View className="flex-row items-center gap-1.5">
              <Text className="text-zinc-100 font-mono text-xs font-black tracking-widest">
                {isConnected ? 'NODE-ONLINE' : connectionState.toUpperCase()}
              </Text>
              <View className="bg-zinc-900 border border-zinc-800 px-1 rounded">
                <Text className="text-[9px] font-mono text-zinc-500">OPTICAL 1K</Text>
              </View>
            </View>
            <Text className="text-zinc-600 font-mono text-[9px] tracking-wider uppercase">
              CHASSIS // PERIPHERAL MODE
            </Text>
          </View>
        </View>

        {/* DPI & Quick Keyboard */}
        <View className="flex-row items-center gap-1 bg-[#0A0D15] p-1 rounded-xl border border-zinc-800/90 shadow-sm">
          {[
            { label: '800', val: 0.7 },
            { label: '1200', val: 1.0 },
            { label: '2400', val: 2.2 },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => {
                triggerHaptic.selection();
                setSensitivity(item.val);
              }}
              className={`px-2 py-1 rounded-lg ${
                sensitivity === item.val ? 'bg-[#CAF300]' : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-mono text-[10px] font-bold ${
                  sensitivity === item.val ? 'text-black' : 'text-zinc-400'
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

          <TouchableOpacity
            className={`p-1.5 rounded-lg border ${
              isAirMouseActive
                ? 'bg-[#38BDF8] border-[#38BDF8]'
                : 'bg-zinc-800/60 border-zinc-700/50'
            }`}
            onPress={() => {
              triggerHaptic.selection();
              setIsAirMouseActive(!isAirMouseActive);
            }}
          >
            <MaterialCommunityIcons
              name="compass-outline"
              size={15}
              color={isAirMouseActive ? '#000000' : '#38BDF8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            className={`p-1.5 rounded-lg border ${
              showMacroDeck
                ? 'bg-[#A855F7] border-[#A855F7]'
                : 'bg-zinc-800/60 border-zinc-700/50'
            }`}
            onPress={() => {
              triggerHaptic.selection();
              setShowMacroDeck(!showMacroDeck);
            }}
          >
            <MaterialCommunityIcons
              name="view-grid-plus-outline"
              size={15}
              color={showMacroDeck ? '#000000' : '#A855F7'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            className={`p-1.5 rounded-lg border ${
              showKeyboard
                ? 'bg-[#CAF300] border-[#CAF300]'
                : 'bg-zinc-800/60 border-zinc-700/50'
            }`}
            onPress={() => {
              triggerHaptic.selection();
              setShowKeyboard(!showKeyboard);
            }}
          >
            <MaterialCommunityIcons
              name="keyboard-outline"
              size={15}
              color={showKeyboard ? '#000000' : '#CAF300'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tactical Stream Deck / Macro Grid Drawer ── */}
      {showMacroDeck && (
        <View className="my-2">
          <MacroDeck />
        </View>
      )}

      {/* ── Keystroke Terminal Drawer ── */}
      {showKeyboard && (
        <Animated.View
          className="bg-[#0B0F17] rounded-2xl p-3 my-2 border border-zinc-800 shadow-xl"
          style={{
            opacity: keyboardAnim,
            transform: [
              {
                translateY: keyboardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          }}
        >
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 bg-black/70 rounded-xl text-white px-3.5 py-2 text-xs border border-zinc-800/90 font-mono"
              placeholder="Stream typing directly to workstation..."
              placeholderTextColor="#475569"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
              autoFocus
            />
            <TouchableOpacity
              className="bg-[#CAF300] rounded-xl px-4 justify-center items-center active:scale-95"
              onPress={handleSendText}
            >
              <Text className="text-black font-mono font-black text-xs tracking-wider">EXEC</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-zinc-800/50">
            {[
              { label: 'ESC', key: 'esc' },
              { label: 'TAB', key: 'tab' },
              { label: 'ENTER', key: 'enter' },
              { label: 'BKSP', key: 'backspace' },
              { label: 'SPACE', key: 'space' },
              { label: 'WIN', key: 'win' },
              { label: 'CTRL', key: 'ctrl' },
              { label: 'ALT', key: 'alt' },
            ].map((k) => (
              <TouchableOpacity
                key={k.label}
                className="bg-zinc-900 active:bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-zinc-800"
                onPress={() => sendKeyTap(k.key)}
              >
                <Text className="text-zinc-300 text-[10px] font-mono font-bold">{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* ── MOUSE SHELL CHASSIS ── */}
      <View className="flex-1 my-2 rounded-[38px] bg-[#07090F] border-2 border-zinc-800/90 p-2.5 justify-between shadow-2xl shadow-black relative overflow-hidden">
        
        {/* Subtle Ergonomic Side Grip Grooves */}
        <View className="absolute left-1 top-1/2 -translate-y-12 gap-1.5 opacity-30">
          <View className="w-1 h-5 rounded-full bg-zinc-600" />
          <View className="w-1 h-7 rounded-full bg-[#CAF300]" />
          <View className="w-1 h-5 rounded-full bg-zinc-600" />
        </View>
        <View className="absolute right-1 top-1/2 -translate-y-12 gap-1.5 opacity-30">
          <View className="w-1 h-5 rounded-full bg-zinc-600" />
          <View className="w-1 h-7 rounded-full bg-[#CAF300]" />
          <View className="w-1 h-5 rounded-full bg-zinc-600" />
        </View>

        {/* ── TOP SECTION: Mouse Click Buttons + Mechanical Scroll Wheel ── */}
        <View className="h-40 flex-row gap-2 relative">
          
          {/* Left Click Trigger Button */}
          <Animated.View className="flex-1" style={{ transform: [{ scale: leftScale }] }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={() =>
                Animated.spring(leftScale, { toValue: 0.96, useNativeDriver: true }).start()
              }
              onPressOut={() =>
                Animated.spring(leftScale, { toValue: 1, friction: 3, useNativeDriver: true }).start()
              }
              onPress={() => {
                triggerHaptic.light();
                sendMouseClick('left');
              }}
              className="w-full h-full bg-[#0D121B] rounded-tl-[30px] rounded-tr-lg rounded-bl-xl rounded-br-md border border-zinc-800 p-3 justify-between active:bg-[#141B26] active:border-[#CAF300]/60"
            >
              <View className="flex-row items-center justify-between">
                <View className="w-2 h-2 rounded-full bg-[#CAF300]" />
                <Text className="text-zinc-600 font-mono text-[9px] tracking-wider">M1</Text>
              </View>

              <View className="items-center py-2">
                <MaterialCommunityIcons name="mouse-left-click" size={26} color="#CAF300" />
                <Text className="text-zinc-200 font-mono font-black text-xs tracking-wider mt-1">
                  LEFT
                </Text>
                <Text className="text-zinc-500 font-mono text-[8px] uppercase">Primary</Text>
              </View>

              {/* Click Finger Alignment Notch */}
              <View className="w-full h-1 bg-zinc-800/80 rounded-full" />
            </TouchableOpacity>
          </Animated.View>

          {/* Center Column: Mechanical Scroll Wheel + Middle Click */}
          <View className="w-16 items-center justify-between py-1">
            <View className="w-full items-center">
              <MaterialCommunityIcons name="menu-up" size={14} color="#64748B" />
            </View>

            {/* Tactile Scroll Wheel Assembly */}
            <Animated.View
              className="w-14 h-24 rounded-full bg-[#0B0E14] border-2 border-zinc-700/80 items-center justify-between py-2 shadow-lg active:border-[#CAF300]"
              style={{ transform: [{ scale: middleScale }] }}
              {...wheelResponder.panHandlers}
            >
              {/* Wheel Traction Grip Notches */}
              <View className="w-6 h-[2px] rounded-full bg-zinc-600" />
              <View className="w-8 h-[2px] rounded-full bg-[#CAF300]" />
              <View className="w-6 h-[2px] rounded-full bg-zinc-600" />
              <View className="w-8 h-[2px] rounded-full bg-[#CAF300]" />
              <View className="w-6 h-[2px] rounded-full bg-zinc-600" />

              {/* Middle Button Indicator Tag */}
              <View className="px-1 py-0.5 rounded bg-zinc-800/90 border border-zinc-700">
                <Text className="text-[#CAF300] font-mono text-[7px] font-black tracking-tighter">
                  M3
                </Text>
              </View>
            </Animated.View>

            <View className="w-full items-center">
              <MaterialCommunityIcons name="menu-down" size={14} color="#64748B" />
              <Text className="text-zinc-600 font-mono text-[8px] mt-0.5 tracking-tight">CLICK</Text>
            </View>
          </View>

          {/* Right Click Trigger Button */}
          <Animated.View className="flex-1" style={{ transform: [{ scale: rightScale }] }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={() =>
                Animated.spring(rightScale, { toValue: 0.96, useNativeDriver: true }).start()
              }
              onPressOut={() =>
                Animated.spring(rightScale, { toValue: 1, friction: 3, useNativeDriver: true }).start()
              }
              onPress={() => {
                triggerHaptic.medium();
                sendMouseClick('right');
              }}
              className="w-full h-full bg-[#0D121B] rounded-tr-[30px] rounded-tl-lg rounded-br-xl rounded-bl-md border border-zinc-800 p-3 justify-between active:bg-[#141B26] active:border-zinc-500"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-zinc-600 font-mono text-[9px] tracking-wider">M2</Text>
                <View className="w-2 h-2 rounded-full bg-zinc-600" />
              </View>

              <View className="items-center py-2">
                <MaterialCommunityIcons name="mouse-right-click" size={26} color="#94A3B8" />
                <Text className="text-zinc-300 font-mono font-black text-xs tracking-wider mt-1">
                  RIGHT
                </Text>
                <Text className="text-zinc-500 font-mono text-[8px] uppercase">Menu</Text>
              </View>

              {/* Click Finger Alignment Notch */}
              <View className="w-full h-1 bg-zinc-800/80 rounded-full" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ── Optical Separation Seam ── */}
        <View className="flex-row items-center justify-center my-1.5 gap-2">
          <View className="flex-1 h-[1px] bg-zinc-800/80" />
          <View className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <Text className="text-zinc-600 font-mono text-[8px] tracking-widest uppercase">
            SENSOR SURFACE
          </Text>
          <View className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <View className="flex-1 h-[1px] bg-zinc-800/80" />
        </View>

        {/* ── BOTTOM SECTION: Curved Mouse Palm Rest Touchpad ── */}
        <View
          className="flex-1 rounded-[28px] bg-[#0A0D15] border border-zinc-800/90 relative overflow-hidden justify-center items-center"
          {...panResponder.panHandlers}
        >
          {/* Animated Glow Wave on Touch */}
          <Animated.View
            pointerEvents="none"
            className="absolute top-0 left-0 w-14 h-14 rounded-full border border-[#CAF300] bg-[#CAF300]/10"
            style={{
              opacity: touchOpacity,
              transform: [
                { translateX: touchPos.x },
                { translateY: touchPos.y },
                { scale: touchScale },
              ],
            }}
          />

          {/* Laser Etch Reticles */}
          <View className="absolute top-3 left-4 opacity-40">
            <Text className="text-zinc-600 font-mono text-[8px]">X-AXIS</Text>
          </View>
          <View className="absolute top-3 right-4 opacity-40">
            <Text className="text-zinc-600 font-mono text-[8px]">Y-AXIS</Text>
          </View>

          {/* Mouse Palm Rest Target Crosshair */}
          <View className="items-center justify-center opacity-20 pointer-events-none">
            <View className="w-12 h-[1px] bg-[#CAF300]" />
            <View className="w-[1px] h-12 bg-[#CAF300] absolute" />
            <View className="w-20 h-20 rounded-full border border-dashed border-[#CAF300] absolute" />
          </View>

          {/* Ergonomic Palm Rest Text */}
          <View className="items-center opacity-30 pointer-events-none mt-2">
            <Text className="text-[#CAF300] font-mono text-xs font-black tracking-[4px]">
              PALM REST TOUCHPAD
            </Text>
            <Text className="text-zinc-400 font-mono text-[9px] mt-1 tracking-tight">
              Glide to Move Cursor &bull; 2-Finger Scroll
            </Text>
          </View>

          {/* Bottom Arc Contour */}
          <View className="absolute bottom-2 w-24 h-1 rounded-full bg-zinc-800/70" />
        </View>
      </View>
    </View>
  );
}
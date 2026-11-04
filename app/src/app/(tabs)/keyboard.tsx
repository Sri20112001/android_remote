/**
 * Keyboard tab.
 *
 * Lives in the tab navigator so it is reachable like any other panel, and
 * adapts to both orientations:
 *
 *  - Portrait gets wide rows (digits, QWERTY, three symbol rows) that keep key
 *    targets thumb-sized on a narrow screen.
 *  - Landscape gets the same QWERTY matrix with the rarer keys (F-keys,
 *    navigation) in a compact scrolling strip above it, because the floating
 *    dock already eats a slice of the short landscape viewport.
 *
 * Every key still goes through the same `input.key_tap` command, so there is
 * no second input path to keep in sync with the trackpad.
 */

import React from 'react';
import {
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAgentWS } from '@/api/use-agent-ws';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { triggerHaptic } from '@/utils/haptics';

/** Modifiers arm themselves and are consumed by the next non-modifier key. */
const MODIFIER_KEYS = new Set(['ctrl', 'alt', 'shift', 'win']);

type KeyTone = 'default' | 'accent' | 'modifier' | 'primary' | 'danger';

interface KeySpec {
  /** Text printed on the keycap. */
  label: string;
  /** Value sent to the agent in `key_tap`. */
  key: string;
  /** Width relative to the other keys in the same row. */
  grow?: number;
  tone?: KeyTone;
}

/** Keys too rare to spend a whole row on, in both orientations. */
const UTILITY_KEYS: KeySpec[] = [
  { label: 'ESC', key: 'esc', tone: 'danger' },
  { label: 'F1', key: 'f1' },
  { label: 'F2', key: 'f2' },
  { label: 'F3', key: 'f3' },
  { label: 'F4', key: 'f4' },
  { label: 'F5', key: 'f5' },
  { label: 'F6', key: 'f6' },
  { label: 'F7', key: 'f7' },
  { label: 'F8', key: 'f8' },
  { label: 'F9', key: 'f9' },
  { label: 'F10', key: 'f10' },
  { label: 'F11', key: 'f11' },
  { label: 'F12', key: 'f12' },
  { label: 'DEL', key: 'delete', tone: 'danger' },
  { label: 'INS', key: 'insert' },
  { label: 'HOME', key: 'home' },
  { label: 'END', key: 'end' },
  { label: 'PGUP', key: 'pageup' },
  { label: 'PGDN', key: 'pagedown' },
];

/* ── Landscape rows ─────────────────────────────────────────────────────── */

const NUMBER_ROW: KeySpec[] = [
  { label: '`', key: '`' },
  { label: '1', key: '1' },
  { label: '2', key: '2' },
  { label: '3', key: '3' },
  { label: '4', key: '4' },
  { label: '5', key: '5' },
  { label: '6', key: '6' },
  { label: '7', key: '7' },
  { label: '8', key: '8' },
  { label: '9', key: '9' },
  { label: '0', key: '0' },
  { label: '-', key: '-' },
  { label: '=', key: '=' },
  { label: 'BKSP', key: 'backspace', grow: 2, tone: 'accent' },
];

const QWERTY_ROW: KeySpec[] = [
  { label: 'TAB', key: 'tab', grow: 1.5, tone: 'accent' },
  { label: 'Q', key: 'q' },
  { label: 'W', key: 'w' },
  { label: 'E', key: 'e' },
  { label: 'R', key: 'r' },
  { label: 'T', key: 't' },
  { label: 'Y', key: 'y' },
  { label: 'U', key: 'u' },
  { label: 'I', key: 'i' },
  { label: 'O', key: 'o' },
  { label: 'P', key: 'p' },
  { label: '[', key: '[' },
  { label: ']', key: ']' },
  { label: '\\', key: '\\', grow: 1.5, tone: 'accent' },
];

const HOME_ROW: KeySpec[] = [
  { label: 'CAPS', key: 'capslock', grow: 1.6, tone: 'accent' },
  { label: 'A', key: 'a' },
  { label: 'S', key: 's' },
  { label: 'D', key: 'd' },
  { label: 'F', key: 'f' },
  { label: 'G', key: 'g' },
  { label: 'H', key: 'h' },
  { label: 'J', key: 'j' },
  { label: 'K', key: 'k' },
  { label: 'L', key: 'l' },
  { label: ';', key: ';' },
  { label: "'", key: "'" },
  { label: 'ENTER', key: 'enter', grow: 2.1, tone: 'primary' },
];

const LETTER_ROW: KeySpec[] = [
  { label: 'SHIFT', key: 'shift', grow: 2.2, tone: 'modifier' },
  { label: 'Z', key: 'z' },
  { label: 'X', key: 'x' },
  { label: 'C', key: 'c' },
  { label: 'V', key: 'v' },
  { label: 'B', key: 'b' },
  { label: 'N', key: 'n' },
  { label: 'M', key: 'm' },
  { label: ',', key: ',' },
  { label: '.', key: '.' },
  { label: '/', key: '/' },
  { label: 'SHIFT', key: 'shift', grow: 2.2, tone: 'modifier' },
];

const SPACE_ROW: KeySpec[] = [
  { label: 'CTRL', key: 'ctrl', grow: 1.4, tone: 'modifier' },
  { label: 'WIN', key: 'win', grow: 1.2, tone: 'modifier' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'SPACE', key: 'space', grow: 6, tone: 'accent' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'CTRL', key: 'ctrl', grow: 1.4, tone: 'modifier' },
  { label: '←', key: 'left' },
  { label: '↑', key: 'up' },
  { label: '↓', key: 'down' },
  { label: '→', key: 'right' },
];

/* ── Portrait rows ───────────────────────────────────────────────────────── */

const PORTRAIT_NUMBER_ROW: KeySpec[] = [
  { label: '1', key: '1' },
  { label: '2', key: '2' },
  { label: '3', key: '3' },
  { label: '4', key: '4' },
  { label: '5', key: '5' },
  { label: '6', key: '6' },
  { label: '7', key: '7' },
  { label: '8', key: '8' },
  { label: '9', key: '9' },
  { label: '0', key: '0' },
];

const PORTRAIT_QWERTY_ROW: KeySpec[] = [
  { label: 'Q', key: 'q' },
  { label: 'W', key: 'w' },
  { label: 'E', key: 'e' },
  { label: 'R', key: 'r' },
  { label: 'T', key: 't' },
  { label: 'Y', key: 'y' },
  { label: 'U', key: 'u' },
  { label: 'I', key: 'i' },
  { label: 'O', key: 'o' },
  { label: 'P', key: 'p' },
];

const PORTRAIT_HOME_ROW: KeySpec[] = [
  { label: 'CAPS', key: 'capslock', grow: 1.5, tone: 'accent' },
  { label: 'A', key: 'a' },
  { label: 'S', key: 's' },
  { label: 'D', key: 'd' },
  { label: 'F', key: 'f' },
  { label: 'G', key: 'g' },
  { label: 'H', key: 'h' },
  { label: 'J', key: 'j' },
  { label: 'K', key: 'k' },
  { label: 'L', key: 'l' },
];

const PORTRAIT_LETTER_ROW: KeySpec[] = [
  { label: 'SHIFT', key: 'shift', grow: 1.8, tone: 'modifier' },
  { label: 'Z', key: 'z' },
  { label: 'X', key: 'x' },
  { label: 'C', key: 'c' },
  { label: 'V', key: 'v' },
  { label: 'B', key: 'b' },
  { label: 'N', key: 'n' },
  { label: 'M', key: 'm' },
  { label: 'BKSP', key: 'backspace', grow: 1.8, tone: 'accent' },
];

const PORTRAIT_SYMBOL_ROW_A: KeySpec[] = [
  { label: '`', key: '`' },
  { label: '-', key: '-' },
  { label: '=', key: '=' },
  { label: '[', key: '[' },
  { label: ']', key: ']' },
  { label: '\\', key: '\\' },
];

const PORTRAIT_SYMBOL_ROW_B: KeySpec[] = [
  { label: ';', key: ';' },
  { label: "'", key: "'" },
  { label: ',', key: ',' },
  { label: '.', key: '.' },
  { label: '/', key: '/' },
];

const PORTRAIT_ACTION_ROW: KeySpec[] = [
  { label: 'TAB', key: 'tab', grow: 1.2, tone: 'accent' },
  { label: 'CTRL', key: 'ctrl', grow: 1.2, tone: 'modifier' },
  { label: 'WIN', key: 'win', grow: 1.2, tone: 'modifier' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'SPACE', key: 'space', grow: 4, tone: 'accent' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'CTRL', key: 'ctrl', grow: 1.2, tone: 'modifier' },
  { label: 'ENTER', key: 'enter', grow: 1.6, tone: 'primary' },
];

const PORTRAIT_ARROW_ROW: KeySpec[] = [
  { label: '←', key: 'left' },
  { label: '↑', key: 'up' },
  { label: '↓', key: 'down' },
  { label: '→', key: 'right' },
];

const LANDSCAPE_ROWS: KeySpec[][] = [
  NUMBER_ROW,
  QWERTY_ROW,
  HOME_ROW,
  LETTER_ROW,
  SPACE_ROW,
];

const PORTRAIT_ROWS: KeySpec[][] = [
  PORTRAIT_NUMBER_ROW,
  PORTRAIT_QWERTY_ROW,
  PORTRAIT_HOME_ROW,
  PORTRAIT_LETTER_ROW,
  PORTRAIT_SYMBOL_ROW_A,
  PORTRAIT_SYMBOL_ROW_B,
  PORTRAIT_ACTION_ROW,
  PORTRAIT_ARROW_ROW,
];

const TONE_STYLES: Record<KeyTone, { base: string; text: string }> = {
  default: {
    base: 'bg-[#12161F] border-zinc-800/90 active:bg-[#1B2330]',
    text: 'text-zinc-200',
  },
  accent: {
    base: 'bg-[#181E29] border-zinc-700/90 active:bg-[#232C3B]',
    text: 'text-zinc-300',
  },
  modifier: {
    base: 'bg-[#101724] border-[#CAF300]/30 active:bg-[#182031]',
    text: 'text-[#CAF300]',
  },
  primary: {
    base: 'bg-[#CAF300] border-[#CAF300] active:bg-[#B4D900]',
    text: 'text-black',
  },
  danger: {
    base: 'bg-[#1A1216] border-rose-500/40 active:bg-[#241820]',
    text: 'text-rose-300',
  },
};

interface KeyRowProps {
  keys: KeySpec[];
  compact: boolean;
  armed: string[];
  onKeyPress: (key: string) => void;
}

function KeyRow({ keys, compact, armed, onKeyPress }: KeyRowProps) {
  return (
    <View className="flex-1 flex-row gap-1">
      {keys.map((spec, index) => {
        const isModifier = MODIFIER_KEYS.has(spec.key);
        const isArmed = isModifier && armed.includes(spec.key);
        const tone = TONE_STYLES[spec.tone ?? 'default'];

        return (
          <TouchableOpacity
            key={`${spec.key}-${index}`}
            activeOpacity={0.65}
            onPress={() => onKeyPress(spec.key)}
            style={{ flexGrow: spec.grow ?? 1, flexBasis: 0 }}
            className={`h-full min-w-0 rounded-lg border items-center justify-center ${
              isArmed ? 'bg-[#CAF300] border-[#CAF300]' : tone.base
            }`}
          >
            <Text
              numberOfLines={1}
              className={`font-mono font-bold tracking-tight ${
                compact ? 'text-[10px]' : 'text-[12px]'
              } ${isArmed ? 'text-black' : tone.text}`}
            >
              {spec.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface KeyStripProps {
  keys: KeySpec[];
  armed: string[];
  onKeyPress: (key: string) => void;
}

/** Horizontally scrolling row for the rare keys on narrow screens. */
function KeyStrip({ keys, armed, onKeyPress }: KeyStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: 32, flexGrow: 0 }}
      contentContainerStyle={{ gap: 6, paddingRight: 6 }}
    >
      {keys.map((spec, index) => {
        const isArmed = MODIFIER_KEYS.has(spec.key) && armed.includes(spec.key);
        const tone = TONE_STYLES[spec.tone ?? 'default'];

        return (
          <TouchableOpacity
            key={`${spec.key}-${index}`}
            activeOpacity={0.65}
            onPress={() => onKeyPress(spec.key)}
            style={{ width: 46 }}
            className={`h-full rounded-md border items-center justify-center ${
              isArmed ? 'bg-[#CAF300] border-[#CAF300]' : tone.base
            }`}
          >
            <Text
              numberOfLines={1}
              className={`font-mono font-bold text-[9px] ${isArmed ? 'text-black' : tone.text}`}
            >
              {spec.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function KeyboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { isConnected, connectionState, sendKeyTap, sendTypeText } = useAgentWS();

  const [armed, setArmed] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState<string>('');

  // A tab is kept mounted while you visit another one, so an armed modifier
  // would otherwise still be waiting when you came back.
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setArmed([]);
        Keyboard.dismiss();
      };
    }, []),
  );

  const pressKey = (key: string) => {
    // Tapping a hardware key means the grid is the thing being used, so get the
    // phone's soft keyboard out of the way if the text field opened it.
    Keyboard.dismiss();

    if (MODIFIER_KEYS.has(key)) {
      triggerHaptic.selection();
      setArmed((previous) =>
        previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key],
      );
      return;
    }

    triggerHaptic.light();
    sendKeyTap(key, armed);
    if (armed.length > 0) setArmed([]);
  };

  const sendDraft = () => {
    if (draft.length === 0) return;
    triggerHaptic.success();
    sendTypeText(draft);
    setDraft('');
  };

  const modifierLabel = armed.length > 0 ? `${armed.join('+').toUpperCase()}+` : 'NO MOD';
  const rows = isLandscape ? LANDSCAPE_ROWS : PORTRAIT_ROWS;

  return (
    <View
      className="flex-1 bg-[#04060A]"
      style={{
        paddingTop: Math.max(insets.top, 10),
        paddingBottom: tabBarClearance,
        paddingLeft: Math.max(insets.left, 10),
        paddingRight: Math.max(insets.right, 10),
      }}
    >
      {/* ── HUD: title, link state, armed modifiers, bulk text ── */}
      <View className="pb-2 border-b border-zinc-800/80">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-lg bg-[#10141D] border border-zinc-800 items-center justify-center">
            <MaterialCommunityIcons name="keyboard-outline" size={17} color="#CAF300" />
          </View>

          <View className={isLandscape ? '' : 'flex-1'}>
            <Text className="text-zinc-100 font-mono text-xs font-black tracking-[2px]">
              KEYBOARD
            </Text>
            <Text className="text-zinc-600 font-mono text-[8px] tracking-wider uppercase">
              {isConnected ? 'NODE-ONLINE // DIRECT INPUT' : connectionState.toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              if (armed.length > 0) {
                triggerHaptic.selection();
                setArmed([]);
              }
            }}
            className={`h-7 px-2.5 rounded-md border flex-row items-center gap-1.5 ${
              armed.length > 0
                ? 'bg-[#CAF300] border-[#CAF300]'
                : 'bg-[#0B0F17] border-zinc-800'
            }`}
          >
            <Text
              numberOfLines={1}
              className={`font-mono text-[10px] font-black tracking-tight ${
                armed.length > 0 ? 'text-black' : 'text-zinc-600'
              }`}
            >
              {modifierLabel}
            </Text>
            {armed.length > 0 && (
              <MaterialCommunityIcons name="close-circle" size={12} color="#000" />
            )}
          </TouchableOpacity>

          {isLandscape && (
            <>
              <TextInput
                className="flex-1 h-8 min-w-[120px] bg-black/70 rounded-lg text-white px-3 text-xs border border-zinc-800/90 font-mono"
                placeholder="Bulk text to the workstation..."
                placeholderTextColor="#475569"
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendDraft}
                returnKeyType="send"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                keyboardAppearance="dark"
                multiline={false}
              />
              <TouchableOpacity
                className="h-8 px-4 rounded-lg bg-[#CAF300] active:bg-[#B4D900] items-center justify-center"
                onPress={sendDraft}
              >
                <Text className="text-black font-mono font-black text-[11px] tracking-wider">
                  SEND
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {!isLandscape && (
          <View className="flex-row items-center gap-2 mt-2">
            <TextInput
              className="flex-1 h-9 bg-black/70 rounded-lg text-white px-3 text-xs border border-zinc-800/90 font-mono"
              placeholder="Bulk text to the workstation..."
              placeholderTextColor="#475569"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={sendDraft}
              returnKeyType="send"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              keyboardAppearance="dark"
              multiline={false}
            />
            <TouchableOpacity
              className="h-9 px-4 rounded-lg bg-[#CAF300] active:bg-[#B4D900] items-center justify-center"
              onPress={sendDraft}
            >
              <Text className="text-black font-mono font-black text-[11px] tracking-wider">
                SEND
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Rare keys, scrolled horizontally so the main matrix stays whole ── */}
      <View className="pt-2">
        <KeyStrip keys={UTILITY_KEYS} armed={armed} onKeyPress={pressKey} />
      </View>

      {/* ── Main key matrix ── */}
      <View className="flex-1 gap-1 pt-1.5">
        {rows.map((row, index) => (
          <KeyRow
            key={index}
            keys={row}
            compact={isLandscape}
            armed={armed}
            onKeyPress={pressKey}
          />
        ))}
      </View>
    </View>
  );
}

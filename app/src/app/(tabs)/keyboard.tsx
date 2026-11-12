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

import { useState, useCallback } from "react";
import { Keyboard, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAgentWS } from "@/api/use-agent-ws";
import { useTabBarClearance } from "@/hooks/use-tab-bar-clearance";
import { triggerHaptic } from "@/utils/haptics";

import {
  MODIFIER_KEYS,
  LANDSCAPE_ROWS,
  PORTRAIT_ROWS,
  UTILITY_KEYS,
  PRODUCTIVITY_SHORTCUTS,
} from "@/data/keyboardKeys";
import { ShortcutSpec } from "@/types/types";

import {
  KeyRow,
  KeyStrip,
  ProductivityRail,
  KeyboardHud,
} from "@/components/keyboard";

export default function KeyboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { isConnected, connectionState, sendKeyTap, sendTypeText } =
    useAgentWS();

  const [armed, setArmed] = useState<string[]>([]);
  const [draft, setDraft] = useState<string>("");

  // A tab is kept mounted while you visit another one, so an armed modifier
  // would otherwise still be waiting when you came back.
  useFocusEffect(
    useCallback(() => {
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
        previous.includes(key)
          ? previous.filter((item) => item !== key)
          : [...previous, key],
      );
      return;
    }

    triggerHaptic.light();
    sendKeyTap(key, armed);
    if (armed.length > 0) setArmed([]);
  };

  const triggerShortcut = (sc: ShortcutSpec) => {
    Keyboard.dismiss();
    triggerHaptic.light();
    // Combine explicit shortcut modifiers with any pre-armed modifiers
    const activeMods = Array.from(new Set([...(sc.modifiers ?? []), ...armed]));
    sendKeyTap(sc.key, activeMods);
    if (armed.length > 0) setArmed([]);
  };

  const sendDraft = () => {
    if (draft.length === 0) return;
    triggerHaptic.success();
    sendTypeText(draft);
    setDraft("");
  };

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
      <KeyboardHud
        isConnected={isConnected}
        connectionState={connectionState}
        isLandscape={isLandscape}
        armed={armed}
        draft={draft}
        onClearArmed={() => setArmed([])}
        onChangeDraft={setDraft}
        onSendDraft={sendDraft}
      />

      {/* ── Productivity quick-action rail ── */}
      <View className="pt-2">
        <ProductivityRail
          shortcuts={PRODUCTIVITY_SHORTCUTS}
          onTrigger={triggerShortcut}
        />
      </View>

      {/* ── Rare keys, scrolled horizontally so the main matrix stays whole ── */}
      <View className="pt-1.5">
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

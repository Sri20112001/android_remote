import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerHaptic } from '@/utils/haptics';

export interface KeyboardHudProps {
  isConnected: boolean;
  connectionState: string;
  isLandscape: boolean;
  armed: string[];
  draft: string;
  onClearArmed: () => void;
  onChangeDraft: (text: string) => void;
  onSendDraft: () => void;
}

export function KeyboardHud({
  isConnected,
  connectionState,
  isLandscape,
  armed,
  draft,
  onClearArmed,
  onChangeDraft,
  onSendDraft,
}: KeyboardHudProps) {
  const modifierLabel = armed.length > 0 ? `${armed.join('+').toUpperCase()}+` : 'NO MOD';

  return (
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
              onClearArmed();
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
              onChangeText={onChangeDraft}
              onSubmitEditing={onSendDraft}
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
              onPress={onSendDraft}
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
            onChangeText={onChangeDraft}
            onSubmitEditing={onSendDraft}
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
            onPress={onSendDraft}
          >
            <Text className="text-black font-mono font-black text-[11px] tracking-wider">
              SEND
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default KeyboardHud;

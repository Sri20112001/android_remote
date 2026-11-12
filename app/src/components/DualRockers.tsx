
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DualRockersProps {
  onSendKey: (key: string) => void;
}

const C = {
  surface: '#1C1916',
  surfaceHigh: '#292522',
  border: '#443A32',
  borderStrong: '#5B4B3D',
  accent: '#B78350',
  accentLight: '#D6B88C',
  text: '#E9E1D7',
  textDim: '#A99B8C',
  textFaint: '#81766B',
};

export function DualRockers({ onSendKey }: DualRockersProps) {
  return (
    <View className="flex-row gap-2.5">
      {/* Volume Rocker */}
      <View
        className="flex-1 rounded-[14px] p-2.5 border gap-2"
        style={{
          backgroundColor: C.surface,
          borderColor: C.border,
        }}
      >
        <Text
          className="text-[9px] font-bold text-center font-mono tracking-wider"
          style={{ color: C.textFaint }}
        >
          VOLUME
        </Text>

        <View
          className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: C.surfaceHigh,
            borderColor: C.borderStrong,
          }}
        >
          <TouchableOpacity
            className="flex-row justify-center items-center py-6 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('volume_up')}
          >
            <MaterialCommunityIcons
              name="plus"
              size={18}
              color={C.accentLight}
            />
            <Text
              className="text-[10px] font-bold font-mono"
              style={{ color: C.text }}
            >
              VOL +
            </Text>
          </TouchableOpacity>

          <View
            className="h-[1px]"
            style={{ backgroundColor: C.border }}
          />

          <TouchableOpacity
            className="flex-row justify-center items-center py-6 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('volume_down')}
          >
            <MaterialCommunityIcons
              name="minus"
              size={18}
              color={C.accentLight}
            />
            <Text
              className="text-[10px] font-bold font-mono"
              style={{ color: C.text }}
            >
              VOL -
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Page / Channel Rocker */}
      <View
        className="flex-1 rounded-[14px] p-2.5 border gap-2"
        style={{
          backgroundColor: C.surface,
          borderColor: C.border,
        }}
      >
        <Text
          className="text-[9px] font-bold text-center font-mono tracking-wider"
          style={{ color: C.textFaint }}
        >
          SCROLL / PAGE
        </Text>

        <View
          className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: C.surfaceHigh,
            borderColor: C.borderStrong,
          }}
        >
          <TouchableOpacity
            className="flex-row justify-center items-center py-6 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('pageup')}
          >
            <MaterialCommunityIcons
              name="chevron-double-up"
              size={18}
              color={C.accentLight}
            />
            <Text
              className="text-[10px] font-bold font-mono"
              style={{ color: C.text }}
            >
              PAGE UP
            </Text>
          </TouchableOpacity>

          <View
            className="h-[1px]"
            style={{ backgroundColor: C.border }}
          />

          <TouchableOpacity
            className="flex-row justify-center items-center py-6 gap-1.5"
            activeOpacity={0.7}
            onPress={() => onSendKey('pagedown')}
          >
            <MaterialCommunityIcons
              name="chevron-double-down"
              size={18}
              color={C.accentLight}
            />
            <Text
              className="text-[10px] font-bold font-mono"
              style={{ color: C.text }}
            >
              PAGE DN
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

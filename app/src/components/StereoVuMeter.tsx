import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

interface StereoVuMeterProps {
  volume: number;
  isMuted: boolean;
}

export const StereoVuMeter = React.memo(function StereoVuMeter({
  volume,
  isMuted,
}: StereoVuMeterProps) {
  const [jitterL, setJitterL] = useState(0);
  const [jitterR, setJitterR] = useState(0);

  useEffect(() => {
    if (volume === 0 || isMuted) {
      const timer = setTimeout(() => {
        setJitterL(0);
        setJitterR(0);
      }, 0);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setJitterL((Math.random() - 0.45) * 14);
      setJitterR((Math.random() - 0.45) * 14);
    }, 140);

    return () => clearInterval(interval);
  }, [volume, isMuted]);

  const effectiveVolL = Math.max(0, Math.min(100, volume + jitterL));
  const effectiveVolR = Math.max(0, Math.min(100, volume + jitterR));

  const renderMeterBars = (channelVolume: number, prefix: string) => (
    <View className="flex-1 gap-[3px]">
      {Array.from({ length: 18 }).map((_, i) => {
        const threshold = (18 - i) * 5.5;
        const active = channelVolume >= threshold;
        const isRed = i < 3;
        const isYellow = i >= 3 && i < 7;

        let activeColor = 'bg-[#CAF300]';
        if (isRed) activeColor = 'bg-[#EF4444]';
        else if (isYellow) activeColor = 'bg-[#F59E0B]';

        return (
          <View
            key={`${prefix}_${i}`}
            className={`h-[5px] rounded-[1px] ${active ? activeColor : 'bg-[#141A24]'}`}
          />
        );
      })}
    </View>
  );

  return (
    <View className="flex-1 bg-[#090C12] rounded-xl p-2.5 border border-[#1A202C]">
      <View className="flex-row justify-between mb-2">
        <Text className="text-[#475569] text-[9px] font-mono">L CH</Text>
        <Text className="text-[#475569] text-[9px] font-mono">VU</Text>
        <Text className="text-[#475569] text-[9px] font-mono">R CH</Text>
      </View>

      <View className="flex-row justify-between items-center">
        {renderMeterBars(effectiveVolL, 'l')}

        <View className="justify-between items-center px-1">
          {['0', '-6', '-12', '-18', '-30', '-inf'].map((marker) => (
            <Text key={marker} className="text-[#334155] text-[8px] font-mono">
              {marker}
            </Text>
          ))}
        </View>

        {renderMeterBars(effectiveVolR, 'r')}
      </View>
    </View>
  );
});
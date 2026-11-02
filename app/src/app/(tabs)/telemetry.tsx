import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgentWS } from '@/api/use-agent-ws';
import { BatteryCellLoader } from '@/components/battery-cell-loader';

interface MetricsData {
  cpu?: { usage_percent: number };
  memory?: {
    total_bytes: number;
    available_bytes: number;
    used_bytes: number;
    usage_percent: number;
  };
  battery?: {
    present: boolean;
    charging: boolean;
    percentage: number;
    life_time_seconds?: number;
  };
  disks?: Array<{
    mount: string;
    total_bytes: number;
    free_bytes: number;
    used_bytes: number;
    usage_percent: number;
  }>;
}

export default function TelemetryScreen() {
  const insets = useSafeAreaInsets();
  const { isConnected, getMetrics, onMetrics } = useAgentWS();

  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Animations
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const cpuAnim = useRef(new Animated.Value(0)).current;
  const ramAnim = useRef(new Animated.Value(0)).current;
  const batteryAnim = useRef(new Animated.Value(100)).current;

  // Oscilloscope sweep line loop
  useEffect(() => {
    const sweep = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 2800,
        useNativeDriver: true,
      })
    );
    sweep.start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      sweep.stop();
      pulse.stop();
    };
  }, [sweepAnim, pulseAnim]);

  // Smoothly animate progress bars with 100% native driver
  useEffect(() => {
    if (metrics?.cpu?.usage_percent !== undefined) {
      Animated.timing(cpuAnim, {
        toValue: Math.min(100, Math.max(0, metrics.cpu.usage_percent)),
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
    if (metrics?.memory?.usage_percent !== undefined) {
      Animated.timing(ramAnim, {
        toValue: Math.min(100, Math.max(0, metrics.memory.usage_percent)),
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
    if (metrics?.battery?.percentage !== undefined) {
      Animated.timing(batteryAnim, {
        toValue: Math.min(100, Math.max(0, metrics.battery.percentage)),
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [metrics, cpuAnim, ramAnim, batteryAnim]);

  const fetchMetrics = () => {
    if (isConnected) {
      getMetrics()
        .then((data) => {
          if (data) setMetrics(data);
        })
        .catch(() => undefined)
        .finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const unsub = onMetrics((data) => {
      if (data) setMetrics(data);
    });

    const interval = setInterval(fetchMetrics, 3000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [isConnected]);

  const formatGB = (bytes?: number) => {
    if (!bytes) return '0.0 GB';
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const cpuPercent = Math.round(metrics?.cpu?.usage_percent ?? 0);
  const ramPercent = Math.round(metrics?.memory?.usage_percent ?? 0);
  const batteryPercent = metrics?.battery?.percentage ?? 100;
  const isCharging = metrics?.battery?.charging ?? false;

  const cpuScale = cpuAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0.001, 1],
    extrapolate: 'clamp',
  });

  const ramScale = ramAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0.001, 1],
    extrapolate: 'clamp',
  });

  const batteryScale = batteryAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0.001, 1],
    extrapolate: 'clamp',
  });

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchMetrics} tintColor="#CAF300" />
      }
    >
      {/* Sub-Header Metadata */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Animated.View style={[styles.squareAccent, { opacity: pulseAnim }]} />
          <Text style={styles.titleText}>// TELEMETRY_CORE</Text>
        </View>
        <View style={styles.rateBadge}>
          <Text style={styles.rateText}>REFRESH: 1000ms // {isConnected ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* Hero Dual Tile: CPU & RAM Gauges with Laser Sweep Line */}
      <View style={styles.heroTile}>
        {/* Animated Laser Sweep Line */}
        <Animated.View
          style={[
            styles.laserSweepLine,
            {
              transform: [
                {
                  translateX: sweepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-60, 360],
                  }),
                },
              ],
            },
          ]}
        />

        {/* CPU Section */}
        <View style={styles.gaugeBlock}>
          <View style={styles.gaugeHeader}>
            <View style={styles.gaugeTitleRow}>
              <View style={[styles.dot, { backgroundColor: '#CAF300' }]} />
              <Text style={styles.gaugeTitle}>PROCESSOR (CPU)</Text>
            </View>
            <Text style={styles.gaugePercent}>{cpuPercent}%</Text>
          </View>

          <View style={styles.progressBarBg}>
            <Animated.View
              style={[
                styles.progressBarFillAnim,
                {
                  transform: [{ scaleX: cpuScale }],
                  backgroundColor: cpuPercent > 80 ? '#EF4444' : '#CAF300',
                },
              ]}
            />
          </View>
          <Text style={styles.gaugeSubText}>LOAD INTENSITY: {cpuPercent > 70 ? 'HIGH' : 'NORMAL'}</Text>
        </View>

        <View style={styles.divider} />

        {/* RAM Section */}
        <View style={styles.gaugeBlock}>
          <View style={styles.gaugeHeader}>
            <View style={styles.gaugeTitleRow}>
              <View style={[styles.dot, { backgroundColor: '#38BDF8' }]} />
              <Text style={styles.gaugeTitle}>MEMORY (RAM)</Text>
            </View>
            <Text style={styles.gaugePercent}>{ramPercent}%</Text>
          </View>

          <View style={styles.progressBarBg}>
            <Animated.View
              style={[
                styles.progressBarFillAnim,
                {
                  transform: [{ scaleX: ramScale }],
                  backgroundColor: ramPercent > 85 ? '#EF4444' : '#38BDF8',
                },
              ]}
            />
          </View>

          <View style={styles.memoryStatsRow}>
            <Text style={styles.gaugeSubText}>
              USED: {formatGB(metrics?.memory?.used_bytes)}
            </Text>
            <Text style={styles.gaugeSubText}>
              TOTAL: {formatGB(metrics?.memory?.total_bytes)}
            </Text>
          </View>
        </View>
      </View>

      {/* Battery & Power Tile */}
      {metrics?.battery?.present && (
        <View style={styles.tile}>
          <View style={styles.tileHeader}>
            <View style={styles.gaugeTitleRow}>
              <MaterialCommunityIcons
                name={isCharging ? "battery-charging" : "battery"}
                size={18}
                color={batteryPercent > 20 ? "#22f49e" : "#EF4444"}
              />
              <Text style={styles.gaugeTitle}>BATTERY & POWER CELL</Text>
            </View>
            <Text style={[styles.gaugePercent, { color: '#22f49e' }]}>{batteryPercent}%</Text>
          </View>

          {/* Stepped Battery Cell Loader with Lightning Bolt */}
          <View style={styles.batteryLoaderCard}>
            <BatteryCellLoader
              percent={batteryPercent}
              isCharging={isCharging}
              color={batteryPercent < 20 && !isCharging ? '#EF4444' : '#22f49e'}
            />
            <View style={styles.batteryMetaCol}>
              <View style={styles.batteryStatusBadge}>
                <View style={[styles.chargingDot, { backgroundColor: isCharging ? '#22f49e' : '#64748B' }]} />
                <Text style={[styles.batteryStatusText, { color: isCharging ? '#22f49e' : '#94A3B8' }]}>
                  {isCharging ? 'AC POWER // CHARGING' : 'DISCHARGING // BATTERY'}
                </Text>
              </View>
              {metrics?.battery?.life_time_seconds && metrics.battery.life_time_seconds > 0 ? (
                <Text style={styles.batteryEstimateText}>
                  EST. RUNTIME: {Math.round(metrics.battery.life_time_seconds / 60)} MINS
                </Text>
              ) : (
                <Text style={styles.batteryEstimateText}>POWER BUS: STABLE (CORE 1.0)</Text>
              )}
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <Animated.View
              style={[
                styles.progressBarFillAnim,
                {
                  transform: [{ scaleX: batteryScale }],
                  backgroundColor: isCharging ? '#22f49e' : batteryPercent < 20 ? '#EF4444' : '#22f49e',
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Storage Drives Tile */}
      <View style={styles.tile}>
        <View style={styles.tileHeader}>
          <View style={styles.gaugeTitleRow}>
            <MaterialCommunityIcons name="harddisk" size={18} color="#CAF300" />
            <Text style={styles.gaugeTitle}>STORAGE VOLUMES</Text>
          </View>
          <Text style={styles.diskCountBadge}>
            {(metrics?.disks?.length ?? 0)} DRIVES
          </Text>
        </View>

        <View style={styles.diskList}>
          {metrics?.disks && metrics.disks.length > 0 ? (
            metrics.disks.map((d) => {
              const usedPct = Math.round(d.usage_percent);
              return (
                <View key={d.mount} style={styles.diskItem}>
                  <View style={styles.diskTitleRow}>
                    <Text style={styles.diskMount}>DRIVE {d.mount}</Text>
                    <Text style={styles.diskUsagePct}>{usedPct}% USED</Text>
                  </View>

                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, usedPct))}%`,
                          backgroundColor: usedPct > 90 ? '#EF4444' : '#F59E0B',
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.diskStatsRow}>
                    <Text style={styles.gaugeSubText}>
                      FREE: {formatGB(d.free_bytes)}
                    </Text>
                    <Text style={styles.gaugeSubText}>
                      TOTAL: {formatGB(d.total_bytes)}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.noDataText}>Probing disk partitions...</Text>
          )}
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
    paddingBottom: 88,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  squareAccent: {
    width: 8,
    height: 8,
    backgroundColor: '#CAF300',
  },
  titleText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
  rateBadge: {
    backgroundColor: '#10141D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2538',
  },
  rateText: {
    color: '#CAF300',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  heroTile: {
    backgroundColor: '#10141D',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  laserSweepLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(202, 243, 0, 0.45)',
    shadowColor: '#CAF300',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#1A202C',
  },
  gaugeBlock: {
    gap: 8,
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gaugeTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  gaugePercent: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressBarFillAnim: {
    height: '100%',
    width: '100%',
    borderRadius: 4,
    transformOrigin: 'left',
  },
  gaugeSubText: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  memoryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tile: {
    backgroundColor: '#10141D',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 12,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batteryLoaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090C12',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#19202E',
    gap: 14,
  },
  batteryMetaCol: {
    flex: 1,
    gap: 4,
  },
  batteryStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chargingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  batteryStatusText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
  batteryEstimateText: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  batterySubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diskCountBadge: {
    color: '#CAF300',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  diskList: {
    gap: 14,
  },
  diskItem: {
    gap: 6,
  },
  diskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diskMount: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  diskUsagePct: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  diskStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noDataText: {
    color: '#475569',
    fontSize: 11,
    fontFamily: Platform.select({ default: 'monospace' }),
    textAlign: 'center',
    paddingVertical: 10,
  },
});

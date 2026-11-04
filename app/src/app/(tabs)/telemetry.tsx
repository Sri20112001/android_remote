import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgentWS, useAgentRTT } from '@/api/use-agent-ws';
import { triggerHaptic } from '@/utils/haptics';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
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
  disks?: {
    mount: string;
    total_bytes: number;
    free_bytes: number;
    used_bytes: number;
    usage_percent: number;
  }[];
}

export default function TelemetryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { isConnected, getMetrics, onMetrics, getProcesses, killProcess } = useAgentWS();
  const rttMs = useAgentRTT();
  const rttLabel = rttMs === null ? '--' : `${rttMs}ms`;

  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [processes, setProcesses] = useState<{ pid: number; name: string; memory_mb: number }[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState<boolean>(false);

  const fetchProcesses = useCallback(() => {
    if (isConnected) {
      setLoadingProcesses(true);
      getProcesses()
        .then((data) => {
          if (data) setProcesses(data);
        })
        .catch(() => undefined)
        .finally(() => setLoadingProcesses(false));
    }
  }, [isConnected, getProcesses]);

  // Animations
  const [sweepAnim] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(0.4));
  const [cpuAnim] = useState(() => new Animated.Value(0));
  const [ramAnim] = useState(() => new Animated.Value(0));
  const [batteryAnim] = useState(() => new Animated.Value(100));

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

  const fetchMetrics = useCallback(() => {
    if (isConnected) {
      fetchProcesses();
      getMetrics()
        .then((data) => {
          if (data) setMetrics(data);
        })
        .catch(() => undefined)
        .finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  }, [isConnected, getMetrics, fetchProcesses]);

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      fetchMetrics();
    }, 0);
    const unsub = onMetrics((data) => {
      if (data) setMetrics(data);
    });

    const interval = setInterval(fetchMetrics, 3000);
    return () => {
      clearTimeout(initialFetch);
      unsub();
      clearInterval(interval);
    };
  }, [isConnected, fetchMetrics, onMetrics]);

  const formatGB = (bytes?: number) => {
    if (!bytes) return '0.0 GB';
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const cpuPercent = Math.round(metrics?.cpu?.usage_percent ?? 0);
  const ramPercent = Math.round(metrics?.memory?.usage_percent ?? 0);
  const batteryPercent = metrics?.battery?.percentage ?? 100;
  const isCharging = metrics?.battery?.charging ?? false;

  const handleKillProcess = (pid: number, name: string) => {
    Alert.alert(
      'TERMINATE WORKLOAD',
      `Are you sure you want to end ${name} (PID: ${pid})?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'END TASK',
          style: 'destructive',
          onPress: () => {
            triggerHaptic.warning();
            killProcess(pid)
              .then(() => {
                triggerHaptic.success();
                fetchProcesses();
              })
              .catch(() => undefined);
          },
        },
      ]
    );
  };

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
      contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchMetrics} tintColor="#CAF300" />
      }
    >
      {/* Sub-Header Metadata */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Animated.View style={[styles.squareAccent, { opacity: pulseAnim }]} />
          <Text style={styles.titleText}>{'// TELEMETRY_CORE'}</Text>
        </View>
        <View style={styles.rateBadge}>
          <Text style={styles.rateText}>REFRESH: 1000ms // {isConnected ? 'LIVE' : 'OFFLINE'}</Text>
          <Text style={styles.rateText}>RTT: {rttLabel}</Text>
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

      {/* Active Workload & Process Matrix */}
      <View style={styles.tile}>
        <View style={styles.tileHeader}>
          <View style={styles.gaugeTitleRow}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.gaugeTitle}>WORKLOAD MATRIX // TOP PROCESSES</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic.selection();
              fetchProcesses();
            }}
            style={styles.refreshIconBtn}
          >
            <MaterialCommunityIcons name="refresh" size={14} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.processList}>
          {processes && processes.length > 0 ? (
            processes.map((p) => (
              <View key={`proc_${p.pid}`} style={styles.processRow}>
                <View style={styles.processLeft}>
                  <Text style={styles.processName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.processPID}>PID: {p.pid}</Text>
                </View>

                <View style={styles.processRight}>
                  <Text style={styles.processMem}>{p.memory_mb.toFixed(1)} MB</Text>
                  <TouchableOpacity
                    style={styles.killBtn}
                    onPress={() => handleKillProcess(p.pid, p.name)}
                  >
                    <Text style={styles.killBtnText}>KILL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>
              {loadingProcesses ? 'Scanning active system processes...' : 'No heavy processes detected'}
            </Text>
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
    gap: 2,
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

  refreshIconBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#1E2538',
  },
  processList: {
    gap: 8,
    marginTop: 4,
  },
  processRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#0D1117',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2130',
  },
  processLeft: {
    flex: 1,
    gap: 2,
    marginRight: 8,
  },
  processName: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  processPID: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  processRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  processMem: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  killBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  killBtnText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
});

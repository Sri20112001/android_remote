import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgentWS } from '@/api/use-agent-ws';

type PendingAction = {
  type: 'restart' | 'shutdown';
  token: string;
  countdown: number;
} | null;

export default function PowerVaultScreen() {
  const insets = useSafeAreaInsets();
  const {
    lockWorkstation,
    sleepWorkstation,
    requestRestart,
    confirmRestart,
    requestShutdown,
    confirmShutdown,
  } = useAgentWS();

  const [pending, setPending] = useState<PendingAction>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Animations
  const alertPulse = useRef(new Animated.Value(1)).current;
  const lockScale = useRef(new Animated.Value(1)).current;
  const sleepScale = useRef(new Animated.Value(1)).current;
  const restartScale = useRef(new Animated.Value(1)).current;
  const shutdownScale = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for safety modal
  useEffect(() => {
    if (pending) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(alertPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(alertPulse, { toValue: 0.95, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [pending, alertPulse]);

  // Toast slide & fade animation
  useEffect(() => {
    if (statusMessage) {
      Animated.spring(toastAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    } else {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [statusMessage, toastAnim]);

  // Countdown timer for 30s confirmation window
  useEffect(() => {
    if (!pending) return;

    if (pending.countdown <= 0) {
      setPending(null);
      setStatusMessage('Confirmation window expired.');
      return;
    }

    const timer = setInterval(() => {
      setPending((prev) => (prev ? { ...prev, countdown: prev.countdown - 1 } : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [pending]);

  const pressSpring = (anim: Animated.Value, action: () => void) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.95, duration: 70, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    action();
  };

  const handleLock = () => {
    pressSpring(lockScale, () => {
      lockWorkstation()
        .then(() => setStatusMessage('Workstation locked successfully.'))
        .catch((err) => Alert.alert('Lock Failed', err.message));
    });
  };

  const handleSleep = () => {
    pressSpring(sleepScale, () => {
      Alert.alert(
        'Put PC to Sleep?',
        'The PC will enter low-power sleep mode.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sleep',
            onPress: () => {
              sleepWorkstation()
                .then(() => setStatusMessage('PC entering sleep mode.'))
                .catch((err) => Alert.alert('Sleep Failed', err.message));
            },
          },
        ]
      );
    });
  };

  const handleStartRestart = () => {
    pressSpring(restartScale, () => {
      requestRestart()
        .then((res) => {
          setPending({
            type: 'restart',
            token: res.token,
            countdown: res.expires_in_seconds || 30,
          });
        })
        .catch((err) => Alert.alert('Request Failed', err.message));
    });
  };

  const handleStartShutdown = () => {
    pressSpring(shutdownScale, () => {
      requestShutdown()
        .then((res) => {
          setPending({
            type: 'shutdown',
            token: res.token,
            countdown: res.expires_in_seconds || 30,
          });
        })
        .catch((err) => Alert.alert('Request Failed', err.message));
    });
  };

  const handleConfirmAction = () => {
    if (!pending) return;

    const token = pending.token;
    const action = pending.type;
    setPending(null);

    if (action === 'restart') {
      confirmRestart(token)
        .then(() => setStatusMessage('Restart command confirmed. Rebooting PC...'))
        .catch((err) => Alert.alert('Restart Failed', err.message));
    } else {
      confirmShutdown(token)
        .then(() => setStatusMessage('Shutdown command confirmed. Powering off PC...'))
        .catch((err) => Alert.alert('Shutdown Failed', err.message));
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}
      contentContainerStyle={styles.content}
    >
      {/* Host Telemetry Ribbon */}
      <View style={styles.telemetryCard}>
        <View style={styles.telemetryHeader}>
          <View style={styles.telemetryDotRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.telemetryTitle}>HOST_LINK: ENCRYPTED // NODE_01</Text>
          </View>
          <Text style={styles.authBadge}>AUTH: PAIRED</Text>
        </View>
        <Text style={styles.telemetrySub}>
          PROTECTED ACTIONS // TWO-STEP CONFIRMATION ENFORCED
        </Text>
      </View>

      {/* Animated Status Notice */}
      {statusMessage && (
        <Animated.View
          style={[
            styles.statusNotice,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialCommunityIcons name="shield-check" size={18} color="#CAF300" />
          <Text style={styles.statusNoticeText}>{statusMessage}</Text>
          <TouchableOpacity onPress={() => setStatusMessage(null)}>
            <MaterialCommunityIcons name="close" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Stage 0: Immediate Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="toggle-switch" size={16} color="#64748B" />
          <Text style={styles.sectionTitle}>STAGE 0 // IMMEDIATE ACTIONS</Text>
        </View>

        {/* Lock Workstation Tile with Spring */}
        <Animated.View style={{ transform: [{ scale: lockScale }] }}>
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={handleLock}
          >
            <View style={[styles.iconBox, { backgroundColor: '#1E293B' }]}>
              <MaterialCommunityIcons name="lock" size={24} color="#CAF300" />
            </View>
            <View style={styles.actionDetails}>
              <Text style={styles.actionName}>Lock Workstation</Text>
              <Text style={styles.actionDesc}>Immediately secures the Windows session</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
          </TouchableOpacity>
        </Animated.View>

        {/* Sleep Mode Tile with Spring */}
        <Animated.View style={{ transform: [{ scale: sleepScale }] }}>
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={handleSleep}
          >
            <View style={[styles.iconBox, { backgroundColor: '#1E293B' }]}>
              <MaterialCommunityIcons name="power-sleep" size={24} color="#38BDF8" />
            </View>
            <View style={styles.actionDetails}>
              <Text style={styles.actionName}>Sleep Mode</Text>
              <Text style={styles.actionDesc}>Suspend state for low power consumption</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Stage 1: Guarded Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="shield-alert" size={16} color="#F59E0B" />
          <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>
            STAGE 1 // GUARDED SAFETY VAULT
          </Text>
        </View>

        {/* Restart PC with Spring */}
        <Animated.View style={{ transform: [{ scale: restartScale }] }}>
          <TouchableOpacity
            style={[styles.actionCard, styles.guardedCard]}
            activeOpacity={0.8}
            onPress={handleStartRestart}
          >
            <View style={[styles.iconBox, { backgroundColor: '#3B2914' }]}>
              <MaterialCommunityIcons name="restart" size={24} color="#F59E0B" />
            </View>
            <View style={styles.actionDetails}>
              <Text style={styles.actionName}>Restart Machine</Text>
              <Text style={styles.actionDesc}>Reboots Windows with 30s safety token flow</Text>
            </View>
            <Text style={styles.vaultBadge}>GUARDED</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Shutdown PC with Spring */}
        <Animated.View style={{ transform: [{ scale: shutdownScale }] }}>
          <TouchableOpacity
            style={[styles.actionCard, styles.destructiveCard]}
            activeOpacity={0.8}
            onPress={handleStartShutdown}
          >
            <View style={[styles.iconBox, { backgroundColor: '#3B1519' }]}>
              <MaterialCommunityIcons name="power" size={24} color="#EF4444" />
            </View>
            <View style={styles.actionDetails}>
              <Text style={[styles.actionName, { color: '#F87171' }]}>Power Off System</Text>
              <Text style={styles.actionDesc}>Complete shutdown with hardware ACPI trigger</Text>
            </View>
            <Text style={[styles.vaultBadge, { color: '#EF4444', borderColor: '#7F1D1D' }]}>
              CRITICAL
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Animated Confirmation Modal */}
      <Modal visible={pending !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Animated Pulsing Alert Icon */}
            <Animated.View
              style={[
                styles.modalIconWrap,
                { transform: [{ scale: alertPulse }] },
              ]}
            >
              <MaterialCommunityIcons
                name={pending?.type === 'shutdown' ? 'power' : 'restart'}
                size={36}
                color={pending?.type === 'shutdown' ? '#EF4444' : '#F59E0B'}
              />
            </Animated.View>

            <Text style={styles.modalTitle}>
              CONFIRM {pending?.type?.toUpperCase()}
            </Text>

            <Text style={styles.modalText}>
              Are you sure you want to {pending?.type} this PC? Windows will commit this command immediately.
            </Text>

            {/* Countdown Badge */}
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>
                TOKEN EXPIRES IN {pending?.countdown}S
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setPending(null)}
              >
                <Text style={styles.cancelModalText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmModalBtn,
                  pending?.type === 'shutdown' && styles.confirmShutdownBtn,
                ]}
                onPress={handleConfirmAction}
              >
                <Text style={styles.confirmModalText}>EXECUTE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 24,
    gap: 16,
  },
  telemetryCard: {
    backgroundColor: '#10141D',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 6,
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CAF300',
  },
  telemetryTitle: {
    color: '#CAF300',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  authBadge: {
    color: '#94A3B8',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  telemetrySub: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  statusNotice: {
    backgroundColor: '#162319',
    borderColor: '#234C2B',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusNoticeText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  actionCard: {
    backgroundColor: '#10141D',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#1E2538',
  },
  guardedCard: {
    borderColor: '#3D2D18',
  },
  destructiveCard: {
    borderColor: '#451A1D',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDetails: {
    flex: 1,
    gap: 2,
  },
  actionName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  actionDesc: {
    color: '#64748B',
    fontSize: 11,
  },
  vaultBadge: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#784712',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 12,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  modalText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  countdownBadge: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  countdownText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 12,
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 12,
  },
  confirmModalBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmShutdownBtn: {
    backgroundColor: '#EF4444',
  },
  confirmModalText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});

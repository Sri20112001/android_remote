/**
 * Connect screen — step 1 of the flow.
 *
 * Two ways to reach the agent:
 *   SCAN QR   — camera reads the payload the PC shows (connection + PIN);
 *   MANUAL    — type `host:port` (or a full URL for TLS agents).
 *
 * CONTINUE always probes `GET /api/v1/health` first, so a wrong address
 * fails here — with an inline message — instead of at the pairing step.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AgentClient, ApiError } from '@/api/client';
import { AppHeader, IconButton } from '@/components/app-header';
import { Banner, Card, MonoLabel } from '@/components/typography';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { useSession } from '@/auth/session';
import { parseAddressInput } from '@/connection/address';
import { parseQrData } from '@/connection/qr';
import { Color, FontFamily, Radius, Spacing, TouchTarget, Type } from '@/theme/tokens';

type Tab = 'scan' | 'manual';

interface Target {
  origin: string;
  pin?: string;
  agentName?: string;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message !== '') return error.message;
  return 'Something went wrong.';
}

export default function ConnectScreen() {
  const router = useRouter();
  const session = useSession();
  const [permission, requestPermission] = useCameraPermissions();

  const [tab, setTab] = useState<Tab>('scan');
  const [manualText, setManualText] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [torch, setTorch] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const scanLocked = useRef(false);
  // An Animated.Value is a render-stable object, not a ref: memoize it.
  const scanLine = useMemo(() => new Animated.Value(0), []);

  // Respect the system "remove animations" setting for the scan line.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      scanLine.setValue(0.5);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, scanLine]);

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanLocked.current) return;
      const result = parseQrData(data);
      if (result.kind === 'error') {
        setError(result.reason);
        return;
      }
      scanLocked.current = true;
      setError(null);
      if (result.kind === 'payload') {
        setTarget({ origin: result.origin, pin: result.pin, agentName: result.payload.agent_name });
      } else {
        setTarget({ origin: result.origin });
      }
    },
    [],
  );

  const continueToPairing = useCallback(async () => {
    let origin: string;
    let pin: string | undefined;

    if (tab === 'scan') {
      if (!target) {
        setError('Scan the QR code shown on your PC first.');
        return;
      }
      origin = target.origin;
      pin = target.pin;
    } else {
      const parsed = parseAddressInput(manualText);
      if (!parsed.ok) {
        setError(parsed.reason);
        return;
      }
      origin = parsed.origin;
    }

    setError(null);
    setProbing(true);
    try {
      await new AgentClient({ origin }).getHealth();
      session.beginConnect(origin, pin);
      router.push('/pair');
    } catch (probeError) {
      setError(messageOf(probeError));
    } finally {
      setProbing(false);
    }
  }, [tab, target, manualText, session, router]);

  const cameraBox = (() => {
    if (permission === null) {
      return <View style={styles.cameraPending} accessibilityLabel="Checking camera permission" />;
    }
    if (!permission.granted) {
      return (
        <View style={styles.permissionBox}>
          <MaterialCommunityIcons name="camera-off-outline" size={32} color={Color.textDim} />
          <Text style={styles.permissionText}>
            {permission.canAskAgain
              ? 'Camera access is needed to scan the pairing QR code.'
              : 'Camera access is blocked. Enable it in system settings, or enter the address manually.'}
          </Text>
          <Button
            label={permission.canAskAgain ? 'Enable camera' : 'Open settings'}
            variant="ghost"
            icon="camera"
            onPress={() => {
              if (permission.canAskAgain) {
                requestPermission();
              } else {
                Linking.openSettings().catch(() => undefined);
              }
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.cameraFrame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanLine.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-70, 70],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
          <Text style={styles.cameraHint}>ALIGN THE QR CODE INSIDE THE FRAME</Text>
        </View>
        <PressableTorch
          enabled={torch}
          onPress={() => setTorch((value) => !value)}
        />
      </View>
    );
  })();

  return (
    <Screen scroll>
      <AppHeader
        accessory={
          session.pendingOrigin !== null ? (
            <IconButton icon="close" label="Cancel connect" onPress={() => session.cancelConnect()} />
          ) : undefined
        }
      />

      <View>
        <MonoLabel>Step 1 // link</MonoLabel>
        <Text style={styles.title}>CONNECT TO PC</Text>
        <Text style={styles.subtitle}>
          Scan the QR code on your PC, or enter the agent address directly.
        </Text>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        <TabButton
          label="Scan QR"
          icon="qrcode-scan"
          selected={tab === 'scan'}
          onPress={() => setTab('scan')}
        />
        <TabButton
          label="Manual"
          icon="keyboard-outline"
          selected={tab === 'manual'}
          onPress={() => setTab('manual')}
        />
      </View>

      {tab === 'scan' ? (
        cameraBox
      ) : (
        <Field
          label="Agent address"
          value={manualText}
          onChangeText={(text) => {
            setManualText(text);
            if (error !== null) setError(null);
          }}
          placeholder="192.168.1.104:8765"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType="URL"
          returnKeyType="go"
          onSubmitEditing={() => {
            continueToPairing();
          }}
          hint="Default port is 8765. Prefix with https:// for a TLS-enabled agent."
          accessibilityLabel="Agent address, for example 192.168.1.104:8765"
        />
      )}

      {tab === 'scan' && target && (
        <Card>
          <View style={styles.targetHeader}>
            <MonoLabel>Target acquired</MonoLabel>
            {target.pin !== undefined && <Pill label="PIN detected" tone="ok" />}
          </View>
          <Text style={styles.targetName} numberOfLines={1}>
            {target.agentName ?? 'TUF Remote agent'}
          </Text>
          <Text style={styles.targetOrigin} numberOfLines={1} ellipsizeMode="middle">
            {target.origin}
          </Text>
          <Button
            label="Scan again"
            variant="ghost"
            icon="refresh"
            onPress={() => {
              scanLocked.current = false;
              setTarget(null);
              setError(null);
            }}
          />
        </Card>
      )}

      {error !== null && <Banner message={error} />}

      <Button
        label="Continue"
        icon="arrow-right"
        loading={probing}
        disabled={tab === 'scan' ? target === null : manualText.trim() === ''}
        onPress={() => {
          continueToPairing();
        }}
      />

      <Text style={styles.footnote}>
        The agent must be running on the PC. Its address and QR code appear in the agent window.
      </Text>
    </Screen>
  );
}

function TabButton({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tab,
        selected && styles.tabSelected,
        pressed && styles.tabPressed,
      ]}>
      <MaterialCommunityIcons
        name={icon}
        size={16}
        color={selected ? Color.onAccent : Color.textDim}
      />
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function PressableTorch({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={enabled ? 'Turn torch off' : 'Turn torch on'}
      accessibilityState={{ selected: enabled }}
      style={({ pressed }) => [styles.torchButton, pressed && styles.torchPressed]}>
      <MaterialCommunityIcons
        name={enabled ? 'flashlight' : 'flashlight-off'}
        size={20}
        color={enabled ? Color.accent : Color.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Type.display,
    marginTop: Spacing.xs,
  },
  subtitle: {
    ...Type.bodyDim,
    marginTop: Spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.sm,
    backgroundColor: Color.surface,
  },
  tabSelected: {
    backgroundColor: Color.accent,
    borderColor: Color.accent,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Color.textDim,
  },
  tabLabelSelected: {
    color: Color.onAccent,
    fontFamily: FontFamily.monoBold,
  },
  cameraFrame: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Color.border,
    backgroundColor: '#000',
  },
  cameraPending: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.border,
    backgroundColor: Color.surface,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 19, 25, 0.25)',
    paddingBottom: Spacing.xl,
  },
  reticle: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Color.accent,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanLine: {
    width: '86%',
    height: 2,
    backgroundColor: Color.accent,
    shadowColor: Color.accent,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  cameraHint: {
    position: 'absolute',
    bottom: Spacing.md,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Color.text,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 4,
  },
  torchButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: TouchTarget,
    height: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(16, 19, 25, 0.72)',
  },
  torchPressed: {
    opacity: 0.7,
  },
  permissionBox: {
    gap: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Color.border,
    borderRadius: Radius.lg,
    backgroundColor: Color.surface,
    padding: Spacing.xl,
  },
  permissionText: {
    ...Type.bodyDim,
    textAlign: 'center',
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  targetName: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    lineHeight: 28,
    color: Color.text,
  },
  targetOrigin: {
    ...Type.data,
    color: Color.accent,
  },
  footnote: {
    ...Type.bodyDim,
    fontSize: 13,
    lineHeight: 18,
    color: Color.textFaint,
    textAlign: 'center',
  },
});

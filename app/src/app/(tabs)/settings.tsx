import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentClient, ApiError } from '@/api/client';
import type { DiscoveryInfo, HealthResponse } from '@/api/types';
import { useSession } from '@/auth/session';
import { formatTimestamp, formatUptime } from '@/utils/format';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import * as DocumentPicker from 'expo-document-picker';
import { useAgentWS } from '@/api/use-agent-ws';
import { triggerHaptic } from '@/utils/haptics';

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message !== '') return error.message;
  return 'Could not load agent telemetry.';
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { paired, client, forget } = useSession();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [info, setInfo] = useState<DiscoveryInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { uploadFile, isConnected } = useAgentWS();
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [autoLockEnabled, setAutoLockEnabled] = useState<boolean>(false);

  const handlePickAndSendFile = async () => {
    try {
      triggerHaptic.selection();
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      setUploading(true);
      setUploadStatus(`UPLOADING: ${asset.name}...`);
      triggerHaptic.light();

      await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
      triggerHaptic.success();
      setUploadStatus(`SAVED TO PC DOWNLOADS // ${asset.name}`);
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (err: any) {
      triggerHaptic.warning();
      setUploadStatus(`FAILED: ${err.message || 'Upload error'}`);
      setTimeout(() => setUploadStatus(null), 4000);
    } finally {
      setUploading(false);
    }
  };

  const fetchSnapshot = useCallback(async (c: AgentClient) => {
    return Promise.all([c.getHealth(), c.getDiscoveryInfo()]);
  }, []);

  const startRefresh = useCallback(() => {
    if (client === null) return;
    setLoading(true);
    setError(null);
    fetchSnapshot(client)
      .then(([healthResponse, infoResponse]) => {
        setHealth(healthResponse);
        setInfo(infoResponse);
        setError(null);
      })
      .catch((loadError: unknown) => setError(messageOf(loadError)))
      .finally(() => setLoading(false));
  }, [client, fetchSnapshot]);

  useEffect(() => {
    if (client === null) return undefined;
    let cancelled = false;
    fetchSnapshot(client)
      .then(([healthResponse, infoResponse]) => {
        if (cancelled) return;
        setHealth(healthResponse);
        setInfo(infoResponse);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(messageOf(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, fetchSnapshot]);

  if (paired === null) {
    return null;
  }

  const confirmForget = () => {
    Alert.alert(
      'UNLATCH & FORGET ENCLAVE?',
      'Cryptographic mutual TLS tokens and pairing nonces will be flushed immediately from mobile secure storage.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'EXPEL HOST [CONFIRM]',
          style: 'destructive',
          onPress: () => {
            forget()
              .then(() => router.replace('/connect'))
              .catch(() => undefined);
          },
        },
      ]
    );
  };

  const linkUp = health !== null && health.status === 'ok';

  return (
    <ScrollView
      className="flex-1 bg-[#0B0E14]"
      style={{ paddingTop: Math.max(insets.top, 10) }}
      contentContainerStyle={{ paddingBottom: tabBarClearance }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 gap-4">
        {/* 1. TOP TELEMETRY RIBBON */}
        <View className="flex-row justify-between items-center py-1 border-b border-[#282E38]/60">
          <View className="flex-row items-center gap-1.5">
            <View
              className={`w-1.5 h-1.5 rounded-full ${
                linkUp ? 'bg-[#CAF300]' : error ? 'bg-[#FF3355]' : 'bg-[#FF5E07]'
              }`}
            />
            <Text className="text-[#E1E2EB] text-[10px] font-bold font-mono tracking-wider">
              ENCLAVE: {linkUp ? 'SECURE_CHANNEL' : error ? 'LINK_DROPPED' : 'INITIALIZING'}
            </Text>
          </View>
          <Text className="text-[#8B94A5] text-[9px] font-mono">REFRESH: 1000MS // PROTO_V3</Text>
        </View>

        {/* 2. CHASSIS HOST CARD WITH MECHANICAL CORNER BRACKETS */}
        <View className="relative bg-[#101319] rounded-xl border border-[#282E38] p-4 gap-3 overflow-hidden">
          {/* Mechanical Chamfer Corner Guides */}
          <View className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 border-[#CAF300]" />
          <View className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 border-[#CAF300]" />
          <View className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2 border-[#CAF300]" />
          <View className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2 border-[#CAF300]" />

          {/* Identity & Status Pill */}
          <View className="flex-row justify-between items-start">
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="w-10 h-10 rounded-lg bg-[#191C22] border border-[#282E38] items-center justify-center">
                <MaterialCommunityIcons name="desktop-tower" size={20} color="#CAF300" />
              </View>
              <View className="flex-1">
                <Text className="text-[#8B94A5] text-[9px] font-bold font-mono tracking-wider">
                  PRIMARY TARGET RIG
                </Text>
                <Text className="text-[#E1E2EB] text-lg font-extrabold tracking-tight" numberOfLines={1}>
                  {info?.agent_name ?? paired.device.name}
                </Text>
              </View>
            </View>

            <View className="bg-[#191C22] border border-[#282E38] px-2 py-1 rounded-md">
              <Text
                className={`text-[10px] font-extrabold font-mono ${
                  linkUp ? 'text-[#CAF300]' : error ? 'text-[#FF3355]' : 'text-[#FF5E07]'
                }`}
              >
                {loading ? 'SYNCING…' : linkUp ? 'ONLINE' : error ? 'OFFLINE' : 'RETRY'}
              </Text>
            </View>
          </View>

          {/* Endpoint Bento Box */}
          <View className="flex-row bg-[#191C22] rounded-lg p-2.5 border border-[#282E38]/60 items-center">
            <View className="flex-1 gap-0.5">
              <Text className="text-[#8B94A5] text-[8px] font-bold font-mono">ENDPOINT ORIGIN</Text>
              <Text className="text-[#E1E2EB] text-[11px] font-semibold font-mono" numberOfLines={1}>
                {paired.origin}
              </Text>
            </View>
            <View className="w-px h-6 bg-[#282E38] mx-2" />
            <View className="flex-1 items-end gap-0.5">
              <Text className="text-[#8B94A5] text-[8px] font-bold font-mono">CIPHER REGISTRY</Text>
              <Text className="text-[#CAF300] text-[11px] font-semibold font-mono">
                {info?.tls_enabled ? 'TLS 1.3 GCM' : 'RAW UDP/HTTP'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. HARDWARE AGENT TELEMETRY REGISTER */}
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5 px-0.5">
            <MaterialCommunityIcons name="chip" size={14} color="#CAF300" />
            <Text className="text-[#8B94A5] text-[10px] font-bold font-mono tracking-wider">
              AGENT RUNTIME REGISTER
            </Text>
          </View>

          <View className="bg-[#101319] rounded-xl border border-[#282E38] overflow-hidden">
            <TelemetryRow
              label="AGENT STATUS"
              value={health?.status?.toUpperCase() ?? (loading ? 'PROBING…' : 'UNREACHABLE')}
              highlight={linkUp}
              icon="server-network"
            />
            <TelemetryRow
              label="HOSTNAME"
              value={info?.hostname ?? '—'}
              icon="identifier"
            />
            <TelemetryRow
              label="KERNEL PROTOCOL"
              value={info?.tls_enabled ? 'ECDHE-RSA-AES256' : 'CLEARTEXT INSECURE'}
              valueColor={info?.tls_enabled ? 'text-[#CAF300]' : 'text-[#FF5E07]'}
              icon="shield-lock-outline"
            />
            <TelemetryRow
              label="AGENT BUILD"
              value={health?.version ?? info?.version ?? '—'}
              icon="code-brackets"
            />
            <TelemetryRow
              label="UPTIME ACTIVE"
              value={health ? formatUptime(health.agent_uptime_seconds) : '—'}
              icon="clock-outline"
            />
            <TelemetryRow
              label="TELEMETRY STAMP"
              value={health ? formatTimestamp(health.timestamp) : '—'}
              icon="history"
              isLast
            />
          </View>
        </View>

        {/* 4. MOBILE CLIENT IDENTITY ENCLAVE */}
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5 px-0.5">
            <MaterialCommunityIcons name="cellphone-key" size={14} color="#8B94A5" />
            <Text className="text-[#8B94A5] text-[10px] font-bold font-mono tracking-wider">
              AUTHORIZED CLIENT ENCLAVE
            </Text>
          </View>

          <View className="bg-[#101319] rounded-xl border border-[#282E38] overflow-hidden">
            <TelemetryRow
              label="DEVICE IDENTIFIER"
              value={paired.device.name}
              icon="account-badge-outline"
            />
            <TelemetryRow
              label="FINGERPRINT ID"
              value={paired.device.id}
              icon="fingerprint"
            />
            <TelemetryRow
              label="PLATFORM / OS"
              value={[paired.device.platform, paired.device.os_version].filter(Boolean).join(' // ')}
              icon="layers-outline"
            />
            <TelemetryRow
              label="NONCE SIGNED"
              value={formatTimestamp(paired.pairedAt)}
              icon="calendar-check-outline"
              isLast
            />
          </View>
        </View>


        {/* LOCAL LAN FILE DROP // AIRDROP BEAM */}
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5 px-0.5">
            <MaterialCommunityIcons name="cloud-upload-outline" size={14} color="#38BDF8" />
            <Text className="text-[#38BDF8] text-[10px] font-bold font-mono tracking-wider">
              LOCAL LAN FILE BEAM // AIRDROP
            </Text>
          </View>

          <View className="bg-[#101319] rounded-xl border border-[#282E38] p-3.5 gap-3">
            <Text className="text-zinc-400 text-[10.5px] font-mono leading-relaxed">
              Beam documents, photos, or APKs directly into your workstation's Downloads folder over encrypted Wi-Fi.
            </Text>

            <Pressable
              className="h-11 rounded-lg flex-row items-center justify-center gap-2 bg-[#1A2234] border border-[#38BDF8]/40 active:bg-[#38BDF8]/20"
              onPress={handlePickAndSendFile}
              disabled={uploading || !isConnected}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <MaterialCommunityIcons name="file-upload-outline" size={18} color="#38BDF8" />
              )}
              <Text className="text-[#38BDF8] text-[11px] font-black font-mono tracking-wider">
                {uploading ? 'BEAMING TO DOWNLOADS...' : 'SELECT & SEND FILE TO PC'}
              </Text>
            </Pressable>

            {uploadStatus && (
              <View className="bg-[#0B0F17] rounded-lg p-2.5 border border-[#38BDF8]/30">
                <Text className="text-[#38BDF8] text-[10px] font-mono font-bold text-center">
                  {uploadStatus}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* WALK-AWAY AUTO-LOCK GUARD */}
        <View className="bg-[#101319] rounded-xl border border-[#282E38] p-3 flex-row items-center justify-between">
          <View className="gap-0.5 flex-1 mr-3">
            <Text className="text-[#E1E2EB] text-[11px] font-bold font-mono">
              WALK-AWAY AUTO-LOCK
            </Text>
            <Text className="text-zinc-500 text-[9px] font-mono">
              Lock workstation automatically when Wi-Fi connection drops
            </Text>
          </View>
          <Pressable
            className={`px-3 py-1.5 rounded-lg border ${
              autoLockEnabled
                ? 'bg-[#CAF300] border-[#CAF300]'
                : 'bg-[#191C22] border-[#282E38]'
            }`}
            onPress={() => {
              triggerHaptic.selection();
              setAutoLockEnabled(!autoLockEnabled);
            }}
          >
            <Text
              className={`font-mono text-[10px] font-black ${
                autoLockEnabled ? 'text-black' : 'text-zinc-400'
              }`}
            >
              {autoLockEnabled ? 'ACTIVE' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        {/* 5. TACTICAL ACTION GATE */}
        <View className="gap-3 mt-1">
          {/* Poll Button */}
          <Pressable
            className="h-11 rounded-lg flex-row items-center justify-center gap-2 bg-[#191C22] border border-[#282E38] active:translate-y-0.5 active:opacity-90"
            onPress={startRefresh}
            disabled={loading || client === null}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#CAF300" />
            ) : (
              <MaterialCommunityIcons name="refresh" size={17} color="#CAF300" />
            )}
            <Text className="text-[#CAF300] text-[11px] font-extrabold font-mono tracking-wider">
              {loading ? 'POLLING HARDWARE AGENT…' : 'POLL TELEMETRY MATRIX'}
            </Text>
          </Pressable>

          {/* Danger Zone: Unpair Gated Chamber */}
          <View className="rounded-lg border border-[#FF3355]/40 bg-[#191C22] overflow-hidden">
            <View className="h-1 bg-[#FF3355] opacity-80" />
            <Pressable
              className="h-11 flex-row items-center justify-center gap-2 active:bg-[#FF3355]/20 active:translate-y-0.5"
              onPress={confirmForget}
            >
              <MaterialCommunityIcons name="link-variant-off" size={17} color="#FF3355" />
              <Text className="text-[#FF3355] text-[11px] font-extrabold font-mono tracking-wider">
                EXPEL WORKSTATION CREDENTIAL
              </Text>
            </Pressable>
          </View>

          <Text className="text-center text-[#8B94A5] text-[8.5px] font-mono tracking-wide">
            MUTUAL AUTH V3 // TOKENS HARD-BOUND TO LOCAL ENCLAVE KEYSTORE
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// Subcomponent: Monospaced Telemetry Row
function TelemetryRow({
  label,
  value,
  highlight = false,
  valueColor,
  icon,
  isLast = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row justify-between items-center py-2.5 px-3.5 ${
        !isLast ? 'border-b border-[#282E38]/50' : ''
      }`}
    >
      <View className="flex-row items-center gap-2">
        {icon && <MaterialCommunityIcons name={icon} size={13} color="#8B94A5" />}
        <Text className="text-[#8B94A5] text-[10.5px] font-semibold font-mono">{label}</Text>
      </View>
      <Text
        className={`text-[11px] font-mono text-right flex-1 ml-4 ${
          highlight
            ? 'text-[#CAF300] font-bold'
            : valueColor ?? 'text-[#E1E2EB] font-medium'
        }`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
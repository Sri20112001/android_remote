import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, ScrollView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentClient, ApiError } from '@/api/client';
import type { DiscoveryInfo, HealthResponse } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { Card, DataRow } from '@/components/typography';
import { formatTimestamp, formatUptime } from '@/utils/format';
import { Color } from '@/theme/tokens';
import { Pill } from '@/components/pill';

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message !== '') return error.message;
  return 'Could not load agent status.';
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, paired, client, forget } = useSession();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [info, setInfo] = useState<DiscoveryInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      'Forget this PC?',
      'The pairing token will be erased from this phone. You will need to pair again with a PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget PC',
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
  const statusLabel = loading
    ? 'Checking…'
    : linkUp
      ? 'Connected'
      : error !== null
        ? 'Offline'
        : 'Reconnecting';

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>SYSTEM DIAGNOSTICS</Text>
          <Text style={styles.headerSub}>HARDWARE AGENT & PAIRING CREDENTIALS</Text>
        </View>
        <Pill
          label={statusLabel}
          tone={linkUp ? 'ok' : error !== null ? 'danger' : 'neutral'}
        />
      </View>

      {/* Host Overview */}
      <View style={styles.overviewCard}>
        <Text style={styles.overviewLabel}>CURRENT HOST AGENT</Text>
        <Text style={styles.overviewName}>{info?.agent_name ?? paired.device.name}</Text>
        <Text style={styles.overviewOrigin}>{paired.origin}</Text>
      </View>

      {/* Agent Runtime Details */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Agent Status</Text>
          <Text style={styles.cardSubtitle}>Host runtime & health telemetry</Text>
        </View>

        <DataRow
          label="Status"
          value={health?.status ?? 'Unavailable'}
          valueColor={linkUp ? Color.accent : Color.textDim}
        />
        <DataRow label="Hostname" value={info?.hostname ?? '—'} wrap />
        <DataRow
          label="Security"
          value={info?.tls_enabled === true ? 'TLS Enabled' : 'Cleartext LAN (HTTP)'}
          valueColor={info?.tls_enabled === true ? Color.accent : Color.warn}
        />
        <DataRow label="Agent Version" value={health?.version ?? info?.version ?? '—'} />
        <DataRow
          label="Uptime"
          value={health !== null ? formatUptime(health.agent_uptime_seconds) : '—'}
        />
        <DataRow
          label="Last Verified"
          value={health !== null ? formatTimestamp(health.timestamp) : '—'}
        />
      </Card>

      {/* Paired Device Information */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Mobile Credential</Text>
          <Text style={styles.cardSubtitle}>Authorized identity token</Text>
        </View>

        <DataRow label="Client Name" value={paired.device.name} wrap />
        <DataRow label="Device ID" value={paired.device.id} wrap />
        <DataRow
          label="Platform"
          value={[paired.device.platform, paired.device.os_version].filter(Boolean).join(' · ')}
          wrap
        />
        <DataRow label="Paired Timestamp" value={formatTimestamp(paired.pairedAt)} />
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <Button
          label="Refresh Diagnostic Status"
          icon="refresh"
          variant="ghost"
          loading={loading && error === null}
          disabled={client === null}
          onPress={startRefresh}
        />

        <Button
          label="Unpair & Forget Machine"
          icon="link-off"
          variant="danger"
          onPress={confirmForget}
        />
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
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.select({ default: 'monospace' }),
    letterSpacing: 0.5,
  },
  headerSub: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  overviewCard: {
    backgroundColor: '#10141D',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2538',
    gap: 4,
  },
  overviewLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  overviewName: {
    color: '#CAF300',
    fontSize: 24,
    fontWeight: '800',
  },
  overviewOrigin: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: Platform.select({ default: 'monospace' }),
  },
  cardHeader: {
    marginBottom: 10,
    gap: 2,
  },
  cardTitle: {
    color: '#CAF300',
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#64748B',
    fontSize: 12,
  },
  actionsRow: {
    gap: 10,
    marginTop: 6,
  },
});

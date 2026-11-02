/**
 * Home — the paired dashboard (Milestone 1 scope: identity + liveness).
 *
 * Shows what the agent reported about itself (health + discovery info)
 * next to what we stored at pairing time, lets the user refresh, and lets
 * them forget the device (wiping the token from the secure store).
 */

import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

import { ApiError, displayOrigin, type AgentClient } from "@/api/client";
import type { DiscoveryInfo, HealthResponse } from "@/api/types";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Banner, Card, DataRow } from "@/components/typography";
import { Pill } from "@/components/pill";
import { Screen } from "@/components/screen";
import { useSession } from "@/auth/session";
import { formatTimestamp, formatUptime } from "@/utils/format";
import { Color } from "@/theme/tokens";

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message !== "") return error.message;
  return "Could not load agent status.";
}

export default function HomeScreen() {
  const router = useRouter();
  const { status, paired, client, forget } = useSession();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [info, setInfo] = useState<DiscoveryInfo | null>(null);
  // True from mount: the first load starts as soon as the client exists.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Shared fetch: no state updates here, so the mount effect may call it.
  const fetchSnapshot = useCallback((activeClient: AgentClient) => {
    return Promise.all([
      activeClient.getHealth(),
      activeClient.getDiscoveryInfo(),
    ]);
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

  // Load once on mount with the client from the session; state updates stay
  // inside the promise callbacks, never in the effect body itself.
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

  // Guard against deep links / refreshes: redirect to tabs when paired.
  useEffect(() => {
    if (status === "loading") return;
    if (status !== "paired") {
      router.replace("/connect");
    } else {
      router.replace("/(tabs)/trackpad");
    }
  }, [status, router]);

  if (paired === null) {
    return null;
  }

  const confirmForget = () => {
    Alert.alert(
      "Forget this device?",
      "The pairing token is deleted from this phone. You will need the PIN from the PC to pair again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Forget",
          style: "destructive",
          onPress: () => {
            forget()
              .then(() => router.replace("/connect"))
              .catch(() => undefined);
          },
        },
      ],
    );
  };

  const linkUp = health !== null && health.status === "ok";
  const statusLabel = loading
    ? "Checking…"
    : linkUp
      ? "Connected"
      : error !== null
        ? "Offline"
        : "Reconnecting";

  return (
    <Screen scroll>
      <AppHeader
        accessory={
          <Pill
            label={statusLabel}
            tone={linkUp ? "ok" : error !== null ? "danger" : "neutral"}
          />
        }
      />

      {/* Device overview */}
      <View className="gap-1 py-2">
        <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Your agent
        </Text>

        <Text
          className="mt-1 text-3xl font-bold text-[#CAF300]"
          numberOfLines={1}
        >
          {info?.agent_name ?? paired.device.name}
        </Text>

        <Text
          className="mt-1 text-sm text-slate-500"
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {displayOrigin(paired.origin)}
        </Text>
      </View>

      {/* Error state */}
      {error !== null && (
        <View className="gap-3">
          <Banner message={error} />

          <Button
            label="Try again"
            icon="refresh"
            variant="ghost"
            loading={loading}
            disabled={client === null}
            onPress={startRefresh}
          />
        </View>
      )}

      {/* Agent information */}
      <Card>
        <View className="mb-3 gap-1">
          <Text className="text-lg font-semibold text-[#CAF300]">
            Agent status
          </Text>

          <Text className="text-sm text-slate-500">
            Connection and runtime information
          </Text>
        </View>

        <DataRow
          label="Status"
          value={health?.status ?? "Unavailable"}
          valueColor={linkUp ? Color.accent : Color.textDim}
        />

        <DataRow label="Hostname" value={info?.hostname ?? "—"} wrap />

        <DataRow
          label="Security"
          value={info?.tls_enabled === true ? "TLS enabled" : "TLS disabled"}
          valueColor={info?.tls_enabled === true ? Color.accent : Color.warn}
        />

        <DataRow
          label="Version"
          value={health?.version ?? info?.version ?? "—"}
        />

        <DataRow
          label="Uptime"
          value={
            health !== null ? formatUptime(health.agent_uptime_seconds) : "—"
          }
        />

        <DataRow
          label="Last checked"
          value={health !== null ? formatTimestamp(health.timestamp) : "—"}
        />
      </Card>

      {/* Paired device information */}
      <Card>
        <View className="mb-3 gap-1">
          <Text className="text-lg font-semibold text-[#CAF300]">
            This device
          </Text>

          <Text className="text-sm text-slate-500">
            Device paired with your agent
          </Text>
        </View>

        <DataRow label="Name" value={paired.device.name} wrap />

        <DataRow label="Device ID" value={paired.device.id} wrap />

        <DataRow
          label="Platform"
          value={[paired.device.platform, paired.device.os_version]
            .filter(Boolean)
            .join(" · ")}
          wrap
        />

        <DataRow label="Paired on" value={formatTimestamp(paired.pairedAt)} />
      </Card>

      {/* Actions */}
      <View className="mt-1 gap-3">
        <Button
          label="Refresh status"
          icon="refresh"
          variant="ghost"
          loading={loading && error === null}
          disabled={client === null}
          onPress={startRefresh}
        />

        <Button
          label="Forget device"
          icon="link-off"
          variant="danger"
          onPress={confirmForget}
        />
      </View>
    </Screen>
  );
}

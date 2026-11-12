import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Layers,
  QrCode,
  Radio,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { Card } from '../components/Card';
import { useAppStore, type ActiveTab } from '../stores/useAppStore';
import type { ActivityEvent, PairedDevice } from '../types';

const CATEGORY_STYLES: Record<ActivityEvent['category'], string> = {
  input: 'border-citrus/30 bg-citrus/10 text-citrus',
  volume: 'border-cyber-cyan/30 bg-cyber-cyan/10 text-cyber-cyan',
  macro: 'border-cyber-amber/30 bg-cyber-amber/10 text-cyber-amber',
  power: 'border-cyber-crimson/30 bg-cyber-crimson/10 text-cyber-crimson',
  file: 'border-cyber-emerald/30 bg-cyber-emerald/10 text-cyber-emerald',
  system: 'border-white/10 bg-white/[0.04] text-slate-400',
  auth: 'border-white/10 bg-white/[0.04] text-slate-400',
};

const QUICK_ACTIONS: {
  id: ActiveTab;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: 'pairing',
    label: 'Pair a Mobile App',
    description: 'Scan QR code or enter PIN',
    icon: QrCode,
  },
  {
    id: 'files',
    label: 'File Beam Inbox',
    description: 'Drop or receive beamed files',
    icon: Inbox,
  },
  {
    id: 'settings',
    label: 'Workstation Settings',
    description: 'Security & device pairing',
    icon: Settings2,
  },
];

interface SummaryMetricTileProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  accent?: 'citrus' | 'cyan' | 'emerald';
}

const SummaryMetricTile: React.FC<SummaryMetricTileProps> = ({
  label,
  value,
  hint,
  icon: Icon,
  badge,
  accent = 'citrus',
}) => {
  const iconBorder =
    accent === 'emerald'
      ? 'border-cyber-emerald/30 bg-cyber-emerald/10 text-cyber-emerald'
      : accent === 'cyan'
      ? 'border-cyber-cyan/30 bg-cyber-cyan/10 text-cyber-cyan'
      : 'border-citrus/30 bg-citrus/10 text-citrus';

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0B0F17]/90 p-4 transition-colors duration-200 hover:border-white/[0.16]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${iconBorder}`}>
          <Icon size={14} />
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold leading-none text-slate-100 tabular-nums">
          {value}
        </span>
        {badge}
      </div>

      <span className="mt-1.5 truncate font-mono text-[10px] text-slate-400">{hint}</span>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const {
    activities,
    clearActivities,
    agentStatus,
    pairedDevices,
    setCurrentTab,
    fetchPairingData,
    revokeDevice,
  } = useAppStore();

  const [selectedDevice, setSelectedDevice] = useState<PairedDevice | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetchPairingData();
    const timer = setInterval(() => {
      fetchPairingData();
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchPairingData]);

  // Online count
  const onlineCount = pairedDevices.filter((d) => d.is_online).length;
  const linked = pairedDevices.length > 0;
  const activeDevice = pairedDevices.find((d) => d.is_online) || pairedDevices[0];

  // Command telemetry counts
  const remoteCommandCount = activities.filter((a) =>
    ['input', 'volume', 'macro', 'power'].includes(a.category)
  ).length;

  const handleRevoke = async (deviceId: string) => {
    if (!window.confirm('Are you sure you want to revoke this connected mobile device?')) {
      return;
    }
    setRevoking(true);
    await revokeDevice(deviceId);
    setSelectedDevice(null);
    setRevoking(false);
  };

  const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Recently';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* 1. Connected Device Telemetry Top Summary Bar */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <SummaryMetricTile
          label="Active Mobile Apps"
          value={onlineCount > 0 ? `${onlineCount} ONLINE` : linked ? '0 ONLINE' : 'NONE'}
          hint={linked ? `${pairedDevices.length} paired phone(s)` : 'Scan QR code to link'}
          icon={Smartphone}
          accent={onlineCount > 0 ? 'emerald' : 'citrus'}
          badge={
            onlineCount > 0 ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            ) : null
          }
        />

        <SummaryMetricTile
          label="LAN Peer Link"
          value={agentStatus.running ? 'DIRECT WI-FI' : 'OFFLINE'}
          hint={`Port ${agentStatus.port} • Local WebSocket`}
          icon={Wifi}
          accent="cyan"
        />

        <SummaryMetricTile
          label="Device Platform"
          value={
            activeDevice?.platform
              ? activeDevice.platform.toUpperCase()
              : linked
              ? 'ANDROID'
              : 'READY'
          }
          hint={activeDevice?.model || 'Remote Deck Mobile'}
          icon={Layers}
        />

        <SummaryMetricTile
          label="Command Traffic"
          value={`${remoteCommandCount} REQ`}
          hint="Remote commands in session"
          icon={Activity}
          accent="citrus"
        />
      </div>

      {/* 2. Main Workspace Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Connected Devices (Click to inspect) & Mobile Telemetry */}
        <div className="space-y-6 lg:col-span-7">
          {/* Connected Devices Card */}
          <Card
            title="CONNECTED APPS"
            subtitle="Click an authorized app to inspect live telemetry & specs"
            action={
              <button
                onClick={() => setCurrentTab('pairing')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-citrus px-3 py-1.5 text-xs font-bold text-obsidian-950 transition-colors hover:bg-citrus-hover"
              >
                <QrCode size={13} />
                <span>Pair New App</span>
              </button>
            }
          >
            {pairedDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <Smartphone size={22} className="text-slate-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200">No mobile apps connected</h4>
                <p className="mt-1 max-w-[280px] text-xs leading-5 text-slate-400">
                  Open the Remote Deck app on your phone and scan the pairing code to start controlling
                  this PC.
                </p>
                <button
                  onClick={() => setCurrentTab('pairing')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-citrus/40 hover:bg-citrus/10 hover:text-citrus"
                >
                  <QrCode size={14} />
                  <span>Open Pairing Code</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pairedDevices.map((device) => {
                  const isOnline = Boolean(device.is_online);

                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className={`group relative flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                        isOnline
                          ? 'border-cyber-emerald/40 bg-gradient-to-r from-cyber-emerald/10 via-[#0B0F17] to-[#0B0F17] shadow-[0_0_20px_rgba(34,197,94,0.06)] hover:border-cyber-emerald/60'
                          : 'border-white/[0.07] bg-white/[0.02] opacity-80 hover:border-white/[0.16] hover:opacity-100'
                      }`}
                    >
                      {/* Left: Device Icon & Identification (NO ID SHOWN) */}
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                            isOnline
                              ? 'border-cyber-emerald/40 bg-cyber-emerald/20 text-cyber-emerald shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                              : 'border-white/[0.08] bg-white/[0.03] text-slate-400'
                          }`}
                        >
                          <Smartphone size={20} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">
                              {device.name || 'Authorized Phone'}
                            </span>
                            {device.platform && (
                              <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-300">
                                {device.platform}
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                            {device.model && <span>{device.model} •</span>}
                            <span>
                              {isOnline
                                ? 'Active now • Streaming'
                                : `Last seen ${formatRelativeTime(device.last_seen_at)}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Distinct Online/Offline Badge & Arrow */}
                      <div className="flex shrink-0 items-center gap-3">
                        {isOnline ? (
                          <div className="flex items-center gap-2 rounded-full border border-cyber-emerald/40 bg-cyber-emerald/15 px-3 py-1 font-mono text-[10px] font-bold text-cyber-emerald shadow-[0_0_14px_rgba(34,197,94,0.25)]">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <span>ONLINE</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] font-medium text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-slate-600" />
                            <span>OFFLINE</span>
                          </div>
                        )}

                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-500 transition-colors group-hover:border-white/20 group-hover:text-slate-200">
                          <ChevronRight size={15} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Connected App Live Telemetry Card */}
          <Card
            title="CONNECTED DEVICE TELEMETRY"
            subtitle="Real-time client telemetry, latency, and interaction telemetry"
            accentColor="emerald"
          >
            {activeDevice ? (
              <div className="space-y-4">
                {/* Active Device Banner */}
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyber-emerald/30 bg-cyber-emerald/10 text-cyber-emerald">
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {activeDevice.name || 'Mobile Remote'}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {activeDevice.model || 'Mobile Device'} •{' '}
                        {activeDevice.os_version
                          ? `OS ${activeDevice.os_version}`
                          : activeDevice.platform || 'Connected'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedDevice(activeDevice)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:text-white"
                    >
                      <span>Inspect Telemetry</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Telemetry Stats Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-mono text-[10px] uppercase tracking-wider">
                        Link Latency
                      </span>
                      <Zap size={13} className="text-citrus" />
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-slate-100">
                      {activeDevice.is_online ? '< 12 ms' : '-- ms'}
                    </div>
                    <span className="mt-1 block font-mono text-[10px] text-slate-400">
                      Direct local LAN socket
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-mono text-[10px] uppercase tracking-wider">
                        Security
                      </span>
                      <ShieldCheck size={13} className="text-cyber-cyan" />
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-slate-100">AES-GCM</div>
                    <span className="mt-1 block font-mono text-[10px] text-slate-400">
                      Token-authorized peer
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-mono text-[10px] uppercase tracking-wider">
                        Commands Sent
                      </span>
                      <Activity size={13} className="text-cyber-emerald" />
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-slate-100">
                      {remoteCommandCount}
                    </div>
                    <span className="mt-1 block font-mono text-[10px] text-slate-400">
                      In current session
                    </span>
                  </div>
                </div>

                {/* Active Capabilities */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    Active Mobile Subsystems
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Trackpad Motion', 'Keyboard Bridge', 'Media Rockers', 'File Beam', 'Power Commands'].map(
                      (feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] font-medium text-slate-300"
                        >
                          <CheckCircle2 size={11} className="text-citrus" />
                          {feature}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Pair a mobile phone to begin streaming device telemetry.
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Live Activity (FIXED HEIGHT) & Quick Actions */}
        <div className="space-y-6 lg:col-span-5">
          {/* Live Activity Card with FIXED HEIGHT whether empty or populated */}
          <div className="h-[460px] flex flex-col">
            <Card
              title="LIVE ACTIVITY"
              subtitle="Incoming commands from your mobile device"
              className="h-full flex flex-col"
              action={
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    {activities.length} event{activities.length === 1 ? '' : 's'}
                  </span>
                  {activities.length > 0 && (
                    <button
                      onClick={clearActivities}
                      title="Clear activity"
                      aria-label="Clear activity"
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-slate-400 transition-colors hover:border-cyber-crimson/30 hover:text-cyber-crimson"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              }
            >
              {activities.length === 0 ? (
                /* Empty state vertically centered within the fixed container */
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                    <Radio size={20} className="text-slate-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">Listening for inputs</h4>
                  <p className="mt-1 max-w-[260px] text-xs leading-5 text-slate-400">
                    Trackpad motions, volume adjustments, and macros will land here in real time.
                  </p>
                </div>
              ) : (
                /* Scrollable list taking the exact remaining height */
                <div className="-mr-1 flex-1 space-y-2 overflow-y-auto pr-1">
                  {activities.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.04]"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          className={`mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${
                            CATEGORY_STYLES[item.category]
                          }`}
                        >
                          {item.category}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-200">
                            {item.message}
                          </div>
                          {item.detail && (
                            <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                              {item.detail}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-[10px] text-slate-500">
                        {item.timestamp}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Actions Card */}
          <Card title="QUICK SHORTCUTS" subtitle="Jump straight in">
            <div className="flex flex-col gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => setCurrentTab(action.id)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors group-hover:border-citrus/40 group-hover:text-citrus">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-200">
                        {action.label}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">
                        {action.description}
                      </span>
                    </span>
                    <ArrowUpRight
                      size={14}
                      className="shrink-0 text-slate-500 transition-colors group-hover:text-slate-300"
                    />
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* 3. Connected Device Details & Telemetry Inspection Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedDevice(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-200"
          />

          {/* Dialog Modal Container */}
          <div className="relative z-10 w-full max-w-lg space-y-5 rounded-2xl border border-white/[0.12] bg-[#0B0F17] p-6 shadow-2xl transition-all">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyber-emerald/40 bg-cyber-emerald/15 text-cyber-emerald">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedDevice.name || 'Mobile Remote'}
                  </h3>
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                    <span>{selectedDevice.platform ? selectedDevice.platform.toUpperCase() : 'MOBILE'}</span>
                    <span>•</span>
                    <span className={selectedDevice.is_online ? 'text-cyber-emerald font-semibold' : 'text-slate-400'}>
                      {selectedDevice.is_online ? 'Online (Connected)' : 'Offline (Standby)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedDevice(null)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-slate-400 transition-colors hover:border-white/20 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Telemetry & Specifications Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="font-mono text-[10px] uppercase text-slate-400">Hardware Model</span>
                  <div className="mt-1 font-semibold text-slate-200">
                    {selectedDevice.model || 'Mobile Device'}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="font-mono text-[10px] uppercase text-slate-400">OS Version</span>
                  <div className="mt-1 font-semibold text-slate-200">
                    {selectedDevice.os_version ? `Version ${selectedDevice.os_version}` : 'Standard'}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="font-mono text-[10px] uppercase text-slate-400">Connection Link</span>
                  <div className="mt-1 font-semibold text-slate-200">
                    Local Wi-Fi WebSocket
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="font-mono text-[10px] uppercase text-slate-400">Status</span>
                  <div className="mt-1 flex items-center gap-1.5 font-semibold text-slate-200">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selectedDevice.is_online ? 'bg-cyber-emerald shadow-[0_0_8px_#22c55e]' : 'bg-slate-600'
                      }`}
                    />
                    <span>{selectedDevice.is_online ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="font-mono text-[10px] uppercase text-slate-400">Paired At</span>
                  <div className="mt-1 font-mono text-[11px] text-slate-300">
                    {new Date(selectedDevice.paired_at).toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="font-mono text-[10px] uppercase text-slate-400">Last Active</span>
                  <div className="mt-1 font-mono text-[11px] text-slate-300">
                    {formatRelativeTime(selectedDevice.last_seen_at)}
                  </div>
                </div>
              </div>

              {/* Protocol Details */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-xs">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Telemetry & Security
                </span>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  Communicates directly over your local subnet without third-party cloud routing. Cryptographic
                  session token is stored securely in the workstation's local database.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-white/[0.07] pt-4">
              <button
                onClick={() => handleRevoke(selectedDevice.id)}
                disabled={revoking}
                className="rounded-xl border border-cyber-crimson/30 bg-cyber-crimson/10 px-4 py-2 text-xs font-bold text-cyber-crimson transition-colors hover:bg-cyber-crimson/20 disabled:opacity-50"
              >
                {revoking ? 'Revoking...' : 'Revoke Device'}
              </button>

              <button
                onClick={() => setSelectedDevice(null)}
                className="rounded-xl bg-white/[0.08] px-5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.14] hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



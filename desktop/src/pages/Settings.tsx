import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Square,
  RotateCw,
  FolderOpen,
  Trash2,
  CheckCircle2,
  Power,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Card } from '../components/Card';
import { StatusPill } from '../components/StatusPill';

export const SettingsPage: React.FC = () => {
  const {
    agentStatus,
    startAgent,
    stopAgent,
    restartAgent,
    isStartingAgent,
    isStoppingAgent,
    pairedDevices,
    revokeDevice,
    openDownloadsFolder,
  } = useAppStore();

  const [revokingAll, setRevokingAll] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [autostart, setAutostart] = useState(false);
  const [loadingAutostart, setLoadingAutostart] = useState(false);

  useEffect(() => {
    invoke<boolean>('get_autostart_status')
      .then((status) => setAutostart(status))
      .catch(() => undefined);
  }, []);

  const toggleAutostart = async () => {
    setLoadingAutostart(true);
    try {
      const newState = !autostart;
      await invoke('set_autostart', { enable: newState });
      setAutostart(newState);
      setSuccessNotice(
        newState
          ? 'Remote Deck configured to launch on Windows login.'
          : 'Auto-launch on Windows login disabled.'
      );
      setTimeout(() => setSuccessNotice(null), 3500);
    } catch (err) {
      console.error('Failed to update autostart:', err);
    } finally {
      setLoadingAutostart(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm('Are you sure you want to revoke all paired mobile devices?')) {
      return;
    }
    setRevokingAll(true);
    for (const dev of pairedDevices) {
      await revokeDevice(dev.id);
    }
    setRevokingAll(false);
    setSuccessNotice('All paired devices have been revoked.');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  return (
    <div className="space-y-5">
      {successNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-citrus/30 bg-citrus/10 px-3 py-2.5 text-xs text-citrus">
          <CheckCircle2 size={16} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 1. Host service — runs silently, controls are here for troubleshooting */}
      <Card
        title="HOST SERVICE"
        subtitle="The local link between this workstation and your phone"
        action={
          <StatusPill
            status={agentStatus.running ? 'online' : 'offline'}
            label={agentStatus.running ? 'READY' : 'STOPPED'}
          />
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-semibold text-slate-200">
                {agentStatus.running ? 'Running in the background' : 'Not running'}
              </div>
              <p className="mt-0.5 max-w-md text-xs leading-5 text-slate-400">
                Remote Deck starts this automatically when the app opens. These controls are here
                in case you need to restart it.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!agentStatus.running ? (
                <button
                  onClick={() => startAgent()}
                  disabled={isStartingAgent}
                  className="flex items-center gap-2 rounded-xl bg-citrus px-4 py-2 text-xs font-bold text-obsidian-950 shadow-md shadow-citrus/20 transition-colors hover:bg-citrus-hover disabled:opacity-50"
                >
                  <Play size={14} fill="currentColor" />
                  <span>{isStartingAgent ? 'Starting...' : 'Start'}</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => restartAgent()}
                    disabled={isStartingAgent}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-white/[0.16] hover:text-white disabled:opacity-50"
                  >
                    <RotateCw size={14} className={isStartingAgent ? 'animate-spin' : ''} />
                    <span>Restart</span>
                  </button>
                  <button
                    onClick={() => stopAgent()}
                    disabled={isStoppingAgent}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-cyber-crimson/30 hover:text-cyber-crimson disabled:opacity-50"
                  >
                    <Square size={13} />
                    <span>{isStoppingAgent ? 'Stopping...' : 'Stop'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300 [&::-webkit-details-marker]:hidden">
              Connection details
              <ChevronDown
                size={14}
                className="transition-transform duration-200 group-open:rotate-180"
              />
            </summary>

            <div className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-white/[0.05] bg-obsidian-900 px-3 py-2 font-mono">
                <span className="block text-[10px] text-slate-500">Listening on</span>
                <span className="font-bold text-slate-200">
                  http://127.0.0.1:{agentStatus.port}
                </span>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-obsidian-900 px-3 py-2 font-mono">
                <span className="block text-[10px] text-slate-500">Service binary</span>
                <span className={agentStatus.executable_found ? 'text-citrus' : 'text-cyber-crimson'}>
                  {agentStatus.executable_found ? 'Found & ready' : 'Not found'}
                </span>
              </div>
              {agentStatus.executable_path && (
                <div className="truncate rounded-lg border border-white/[0.05] bg-obsidian-900 px-3 py-2 font-mono text-[11px] text-slate-500 sm:col-span-2">
                  {agentStatus.executable_path}
                </div>
              )}
            </div>
          </details>
        </div>
      </Card>

      {/* 2. System startup */}
      <Card
        title="STARTUP & AUTO-LAUNCH"
        subtitle="Configure workstation startup preferences"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-semibold text-slate-200">
              Start Remote Deck on Windows login
            </div>
            <p className="mt-0.5 max-w-md text-xs leading-5 text-slate-400">
              Launches the desktop control center and the background link service when you sign in
              to this PC.
            </p>
          </div>

          <button
            onClick={toggleAutostart}
            disabled={loadingAutostart}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              autostart
                ? 'bg-citrus text-obsidian-950 shadow-md shadow-citrus/20 hover:bg-citrus-hover'
                : 'border border-white/[0.09] bg-white/[0.03] text-slate-300 hover:border-white/[0.16]'
            }`}
          >
            <Power size={13} />
            <span>{loadingAutostart ? 'Updating...' : autostart ? 'ENABLED' : 'DISABLED'}</span>
          </button>
        </div>
      </Card>

      {/* 3. File Beam storage */}
      <Card
        title="FILE BEAM STORAGE"
        subtitle="Incoming files beamed from the phone are stored locally"
        action={
          <button
            onClick={() => openDownloadsFolder()}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/[0.16] hover:text-white"
          >
            <FolderOpen size={14} />
            <span>Open in Explorer</span>
          </button>
        }
      >
        <div className="space-y-2 text-xs text-slate-400">
          <p>
            Target directory:{' '}
            <code className="rounded bg-obsidian-900 px-2 py-0.5 font-mono text-slate-300">
              %USERPROFILE%\Downloads
            </code>
          </p>
          <p className="text-[11px] leading-5 text-slate-500">
            Files received over the local Wi-Fi connection arrive without third-party cloud routing
            or size throttles.
          </p>
        </div>
      </Card>

      {/* 4. Security & device access */}
      <Card
        title="SECURITY & DEVICE ACCESS"
        subtitle="Manage trusted mobile credentials and pairing tokens"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-semibold text-slate-200">
              {pairedDevices.length} paired mobile device{pairedDevices.length === 1 ? '' : 's'}
            </div>
            <p className="mt-0.5 max-w-md text-xs leading-5 text-slate-400">
              Revoking devices immediately clears their cryptographic session tokens from the local
              database.
            </p>
          </div>

          {pairedDevices.length > 0 && (
            <button
              onClick={handleRevokeAll}
              disabled={revokingAll}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-cyber-crimson/30 bg-cyber-crimson/10 px-4 py-2 text-xs font-semibold text-cyber-crimson transition-colors hover:bg-cyber-crimson/20 disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>{revokingAll ? 'Revoking...' : 'Revoke all devices'}</span>
            </button>
          )}
        </div>
      </Card>

      {/* 5. About */}
      <Card title="ABOUT REMOTE DECK" subtitle="Open source workstation companion">
        <div className="space-y-3 text-xs text-slate-300">
          <div className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-obsidian-900 p-3">
              <span className="block text-[10px] text-slate-500">App name</span>
              <span className="font-bold text-slate-200">Remote Deck</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-obsidian-900 p-3">
              <span className="block text-[10px] text-slate-500">Version</span>
              <span className="font-bold text-slate-200">0.1.0</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-obsidian-900 p-3">
              <span className="block text-[10px] text-slate-500">License</span>
              <span className="font-bold text-citrus">MIT License</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-obsidian-900 p-3">
              <span className="block text-[10px] text-slate-500">Architecture</span>
              <span className="font-bold text-slate-200">Tauri v2 + Go</span>
            </div>
          </div>

          <p className="pt-1 text-xs leading-5 text-slate-400">
            Remote Deck is a lightweight, open-source personal remote control application for any
            Windows PC and mobile device. Free of proprietary locks and ready for open-source
            distribution.
          </p>
        </div>
      </Card>
    </div>
  );
};

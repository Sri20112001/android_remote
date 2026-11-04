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
    <div className="space-y-6">
      {successNotice && (
        <div className="p-3 bg-citrus/15 border border-citrus/30 text-citrus rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 1. Workstation Host Daemon Management */}
      <Card
        title="HOST DAEMON ENGINE"
        subtitle="Manage the background Go process powering local remote control"
        action={
          <StatusPill
            status={agentStatus.running ? 'online' : 'offline'}
            label={agentStatus.running ? 'DAEMON RUNNING' : 'DAEMON STOPPED'}
          />
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-obsidian-900 border border-obsidian-800 rounded-xl space-y-1">
              <span className="text-slate-500 block">Listening Socket:</span>
              <span className="text-slate-200 font-bold">http://127.0.0.1:{agentStatus.port}</span>
            </div>
            <div className="p-3 bg-obsidian-900 border border-obsidian-800 rounded-xl space-y-1">
              <span className="text-slate-500 block">Binary Status:</span>
              <span className={agentStatus.executable_found ? 'text-citrus' : 'text-cyber-crimson'}>
                {agentStatus.executable_found ? 'Executable Found & Ready' : 'Binary Not Found'}
              </span>
            </div>
          </div>

          {agentStatus.executable_path && (
            <div className="p-2.5 bg-obsidian-900/60 border border-obsidian-800 rounded-lg text-[11px] font-mono text-slate-400 truncate">
              Path: {agentStatus.executable_path}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!agentStatus.running ? (
              <button
                onClick={() => startAgent()}
                disabled={isStartingAgent}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-citrus text-obsidian-950 font-bold text-xs hover:bg-citrus-hover transition-colors shadow-md shadow-citrus/20 disabled:opacity-50"
              >
                <Play size={14} fill="currentColor" />
                <span>{isStartingAgent ? 'Starting...' : 'Start Daemon'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => stopAgent()}
                  disabled={isStoppingAgent}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-obsidian-800 border border-obsidian-700 hover:bg-cyber-crimson/15 hover:border-cyber-crimson/30 hover:text-cyber-crimson text-slate-300 font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  <Square size={14} />
                  <span>{isStoppingAgent ? 'Stopping...' : 'Stop Daemon'}</span>
                </button>
                <button
                  onClick={() => restartAgent()}
                  disabled={isStartingAgent}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-obsidian-800 border border-obsidian-700 hover:bg-obsidian-700 text-slate-300 font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  <RotateCw size={14} className={isStartingAgent ? 'animate-spin' : ''} />
                  <span>Restart</span>
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* 2. System Startup & Automation */}
      <Card
        title="SYSTEM STARTUP & AUTO-LAUNCH"
        subtitle="Configure workstation startup preferences"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-200">
              Start Remote Deck on Windows Login
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically launch the desktop control center and background agent when you sign into this PC.
            </p>
          </div>

          <button
            onClick={toggleAutostart}
            disabled={loadingAutostart}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 ${
              autostart
                ? 'bg-citrus text-obsidian-950 hover:bg-citrus-hover shadow-md shadow-citrus/20'
                : 'bg-obsidian-800 border border-obsidian-700 text-slate-300 hover:bg-obsidian-700'
            }`}
          >
            <Power size={13} />
            <span>{loadingAutostart ? 'Updating...' : autostart ? 'ENABLED' : 'DISABLED'}</span>
          </button>
        </div>
      </Card>

      {/* 3. File Beam & Storage */}
      <Card
        title="FILE BEAM STORAGE"
        subtitle="Incoming files beamed from the phone are stored locally"
        action={
          <button
            onClick={() => openDownloadsFolder()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-obsidian-800 border border-obsidian-700 text-slate-300 hover:text-slate-100 text-xs font-medium transition-colors"
          >
            <FolderOpen size={14} />
            <span>Open in Explorer</span>
          </button>
        }
      >
        <div className="text-xs text-slate-400 space-y-2">
          <p>
            Target directory: <code className="bg-obsidian-900 px-2 py-0.5 rounded text-slate-300 font-mono">%USERPROFILE%\Downloads</code>
          </p>
          <p className="text-[11px] text-slate-500">
            Files received over the local Wi-Fi connection arrive without third-party cloud routing or size throttles.
          </p>
        </div>
      </Card>

      {/* 3. Security & Device Access */}
      <Card
        title="SECURITY & DEVICE ACCESS"
        subtitle="Manage trusted mobile credentials and pairing tokens"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-200">
              {pairedDevices.length} Paired Mobile Device{pairedDevices.length === 1 ? '' : 's'}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Revoking devices immediately clears their cryptographic session tokens from the local database.
            </p>
          </div>

          {pairedDevices.length > 0 && (
            <button
              onClick={handleRevokeAll}
              disabled={revokingAll}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyber-crimson/15 border border-cyber-crimson/30 text-cyber-crimson hover:bg-cyber-crimson/25 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>{revokingAll ? 'Revoking...' : 'Revoke All Devices'}</span>
            </button>
          )}
        </div>
      </Card>

      {/* 4. Open Source & System Information */}
      <Card title="ABOUT REMOTE DECK" subtitle="Open source workstation companion">
        <div className="space-y-3 text-xs text-slate-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 bg-obsidian-900 border border-obsidian-800 rounded-xl">
              <span className="text-slate-500 block text-[10px]">App Name</span>
              <span className="text-slate-200 font-bold">Remote Deck</span>
            </div>
            <div className="p-3 bg-obsidian-900 border border-obsidian-800 rounded-xl">
              <span className="text-slate-500 block text-[10px]">Version</span>
              <span className="text-slate-200 font-bold">0.1.0</span>
            </div>
            <div className="p-3 bg-obsidian-900 border border-obsidian-800 rounded-xl">
              <span className="text-slate-500 block text-[10px]">License</span>
              <span className="text-citrus font-bold">MIT License</span>
            </div>
            <div className="p-3 bg-obsidian-900 border border-obsidian-800 rounded-xl">
              <span className="text-slate-500 block text-[10px]">Architecture</span>
              <span className="text-slate-200 font-bold">Tauri v2 + Go</span>
            </div>
          </div>

          <p className="text-slate-400 text-xs pt-2">
            Remote Deck is a lightweight, open-source personal remote control application designed for any Windows PC and mobile device. Free of proprietary locks and ready for open-source distribution.
          </p>
        </div>
      </Card>
    </div>
  );
};

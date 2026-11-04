import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { StatusPill } from './StatusPill';
import { Logo } from './Logo';

export const HeaderBar: React.FC = () => {
  const { agentStatus, refreshAgentStatus } = useAppStore();

  const handleDragStart = (e: React.MouseEvent) => {
    // Only drag on left click and ignore clicks on buttons/interactive elements
    if (e.buttons === 1 && (e.target as HTMLElement).closest('button') === null) {
      invoke('window_start_drag').catch(() => {});
    }
  };

  const handleMinimize = () => {
    invoke('window_minimize').catch((err) => console.error('Minimize error:', err));
  };

  const handleToggleMaximize = () => {
    invoke('window_toggle_maximize').catch((err) => console.error('Maximize error:', err));
  };

  const handleClose = () => {
    invoke('window_close').catch((err) => console.error('Close error:', err));
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleDragStart}
      className="h-11 bg-obsidian-950/95 backdrop-blur-md border-b border-obsidian-800/80 flex items-center justify-between select-none relative z-50 text-xs shrink-0"
    >
      {/* Left: Brand Identity & Live Status */}
      <div className="flex items-center gap-3 pl-3 pointer-events-auto">
        <Logo size="xs" glow={false} />
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wider text-slate-100 text-xs font-mono">
            REMOTE <span className="text-citrus">DECK</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 bg-obsidian-900 px-1.5 py-0.5 rounded border border-obsidian-800">
            WORKSTATION
          </span>
        </div>

        <div className="hidden md:flex items-center ml-2">
          {agentStatus.running ? (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
              <ShieldCheck size={13} className="text-citrus" />
              <StatusPill status="online" label="DAEMON :8765" size="sm" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <ShieldAlert size={13} className="text-cyber-crimson" />
              <StatusPill status="offline" label="DAEMON OFFLINE" size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Middle: Draggable Center Region */}
      <div data-tauri-drag-region onMouseDown={handleDragStart} className="flex-1 h-full cursor-move" />

      {/* Right: Actions & Window Controls */}
      <div className="flex items-center h-full pointer-events-auto">
        <button
          onClick={() => refreshAgentStatus()}
          title="Refresh Daemon Status"
          className="p-1.5 mr-2 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <RefreshCw size={13} />
        </button>

        {/* Windows Standard Window Action Buttons */}
        <div className="flex items-center h-full border-l border-obsidian-800/80">
          <button
            onClick={handleMinimize}
            title="Minimize"
            className="w-11 h-full flex items-center justify-center hover:bg-obsidian-800 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={handleToggleMaximize}
            title="Maximize / Restore"
            className="w-11 h-full flex items-center justify-center hover:bg-obsidian-800 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <Square size={11} />
          </button>
          <button
            onClick={handleClose}
            title="Close (Minimizes to Tray)"
            className="w-11 h-full flex items-center justify-center hover:bg-cyber-crimson text-slate-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};

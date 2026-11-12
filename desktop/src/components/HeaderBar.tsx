import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Menu, Minus, Square, X } from 'lucide-react';

import { useAppStore } from '../stores/useAppStore';
import { navItemFor } from '../navigation';
import { StatusPill } from './StatusPill';
import { Logo } from './Logo';

export const HeaderBar: React.FC = () => {
  const {
    agentStatus,
    currentTab,
    setMobileNavOpen,
  } = useAppStore();

  const page = navItemFor(currentTab);
  const linkReady = agentStatus.running;

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
      className="relative z-50 flex h-11 shrink-0 select-none items-center justify-between border-b border-white/[0.06] bg-obsidian-950/90 text-xs backdrop-blur-md"
    >
      {/* Left: navigation toggle, brand, current page */}
      <div className="pointer-events-auto flex items-center gap-2.5 pl-2 sm:pl-3">
        <button
          onClick={() => setMobileNavOpen(true)}
          title="Open navigation"
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 lg:hidden"
        >
          <Menu size={16} />
        </button>

        <Logo size="xs" glow={false} />

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold tracking-wider text-slate-100">
            REMOTE <span className="text-citrus">DECK</span>
          </span>
          <span className="hidden text-[10px] font-mono text-slate-500 sm:inline">
            /
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:inline">
            {page.label}
          </span>
        </div>

        <div className="ml-2 hidden md:flex">
          <StatusPill
            status={linkReady ? 'online' : 'standby'}
            label={linkReady ? 'LINK READY' : 'CONNECTING'}
            size="sm"
          />
        </div>
      </div>

      {/* Middle: draggable region */}
      <div data-tauri-drag-region onMouseDown={handleDragStart} className="h-full flex-1 cursor-move" />

      {/* Right: window controls */}
      <div className="pointer-events-auto flex h-full items-center">
        <div className="flex h-full items-center border-l border-white/[0.06]">
          <button
            onClick={handleMinimize}
            title="Minimize"
            className="flex h-full w-11 items-center justify-center text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={handleToggleMaximize}
            title="Maximize / Restore"
            className="flex h-full w-11 items-center justify-center text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
          >
            <Square size={11} />
          </button>
          <button
            onClick={handleClose}
            title="Close (Minimizes to Tray)"
            className="flex h-full w-11 items-center justify-center text-slate-400 transition-colors hover:bg-cyber-crimson hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};

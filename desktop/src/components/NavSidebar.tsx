import React from 'react';
import { Activity, QrCode, Inbox, Settings, ChevronLeft, ChevronRight, Power, Smartphone, ShieldCheck } from 'lucide-react';
import { useAppStore, ActiveTab } from '../stores/useAppStore';
import { Logo } from './Logo';

export const NavSidebar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    isSidebarExpanded,
    toggleSidebar,
    agentStatus,
    pairedDevices,
    startAgent,
    stopAgent,
    isStartingAgent,
    isStoppingAgent,
  } = useAppStore();

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Live Watcher',
      desc: 'Real-time Phone HUD',
      icon: Activity,
      badge: pairedDevices.length > 0 ? `${pairedDevices.length}` : undefined,
    },
    {
      id: 'pairing' as ActiveTab,
      label: 'Pairing Hub',
      desc: 'QR Code & PIN Auth',
      icon: QrCode,
    },
    {
      id: 'files' as ActiveTab,
      label: 'File Beam',
      desc: 'LAN Drops Inbox',
      icon: Inbox,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      desc: 'Daemon & Workstation',
      icon: Settings,
    },
  ];

  return (
    <aside
      className={`h-full bg-[#080B10]/90 backdrop-blur-xl border-r border-white/5 transition-all duration-300 flex flex-col justify-between select-none z-40 relative shadow-2xl ${
        isSidebarExpanded ? 'w-64' : 'w-[72px]'
      }`}
    >
      {/* Top Header / Brand Nav */}
      <div className="p-3 space-y-4">
        {/* Toggle Collapse Header */}
        <div className="flex items-center justify-between px-1 pt-1 pb-1">
          <Logo size="sm" showText={isSidebarExpanded} glow={true} />
          <button
            onClick={toggleSidebar}
            title={isSidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all duration-200 ml-auto"
          >
            {isSidebarExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Uiverse-Style Floating Nav Buttons */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                title={!isSidebarExpanded ? item.label : undefined}
                className={`w-full group relative flex items-center gap-3.5 rounded-xl p-3 transition-all duration-300 text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-citrus/15 via-white/[0.04] to-transparent text-slate-100 border border-citrus/30 shadow-[0_4px_20px_rgba(202,243,0,0.08)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03] border border-transparent hover:border-white/5'
                }`}
              >
                {/* Active Indicator Bar with Glow */}
                {isActive && (
                  <div className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-citrus rounded-r-full shadow-[0_0_12px_#CAF300]" />
                )}

                {/* Icon Container with subtle radial glow on hover */}
                <div
                  className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 ${
                    isActive
                      ? 'bg-citrus/20 text-citrus border border-citrus/40 shadow-[0_0_15px_rgba(202,243,0,0.2)]'
                      : 'bg-obsidian-900/80 text-slate-400 group-hover:text-slate-200 group-hover:bg-white/5 border border-white/5'
                  }`}
                >
                  <Icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
                </div>

                {isSidebarExpanded && (
                  <div className="flex-1 min-w-0 pr-1 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold tracking-wide truncate">{item.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{item.desc}</div>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-citrus/20 text-citrus border border-citrus/40 shadow-[0_0_8px_rgba(202,243,0,0.2)]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Uiverse-Style Glassmorphic Workstation Dock Widget */}
      <div className="p-3 border-t border-white/5 bg-black/40">
        {isSidebarExpanded ? (
          <div className="p-3 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {agentStatus.running && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-citrus opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      agentStatus.running ? 'bg-citrus' : 'bg-cyber-crimson'
                    }`}
                  />
                </span>
                <span className="text-[11px] font-bold text-slate-200 font-mono tracking-wider">
                  {agentStatus.running ? 'DAEMON ACTIVE' : 'DAEMON STOPPED'}
                </span>
              </div>

              {/* Uiverse-style tactile toggle button */}
              <button
                onClick={() => (agentStatus.running ? stopAgent() : startAgent())}
                disabled={isStartingAgent || isStoppingAgent}
                title={agentStatus.running ? 'Stop Host Daemon' : 'Start Host Daemon'}
                className={`p-2 rounded-xl border transition-all duration-200 active:scale-95 shadow-md ${
                  agentStatus.running
                    ? 'bg-obsidian-800/80 border-white/10 text-slate-400 hover:text-cyber-crimson hover:bg-cyber-crimson/15 hover:border-cyber-crimson/30'
                    : 'bg-citrus text-obsidian-950 border-citrus font-bold shadow-[0_0_15px_rgba(202,243,0,0.3)] hover:bg-citrus-hover'
                }`}
              >
                <Power size={13} />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={11} className="text-citrus" />
                <span>Port {agentStatus.port}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Smartphone size={11} className="text-slate-400" />
                <span>{pairedDevices.length} Paired</span>
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => (agentStatus.running ? stopAgent() : startAgent())}
            title={agentStatus.running ? 'Daemon Active (Click to Stop)' : 'Daemon Stopped (Click to Start)'}
            className={`w-full p-3 rounded-2xl border flex items-center justify-center transition-all duration-200 active:scale-95 shadow-md ${
              agentStatus.running
                ? 'bg-obsidian-900 border-white/10 text-citrus shadow-[0_0_12px_rgba(202,243,0,0.15)] hover:border-citrus/40'
                : 'bg-obsidian-900 border-white/10 text-cyber-crimson hover:border-cyber-crimson/40'
            }`}
          >
            <Power size={18} />
          </button>
        )}
      </div>
    </aside>
  );
};

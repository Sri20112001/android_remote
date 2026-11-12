import React, { useEffect } from 'react';
import { ChevronLeft, Smartphone, Wifi, X } from 'lucide-react';

import { useAppStore } from '../stores/useAppStore';
import { NAV_ITEMS } from '../navigation';
import { Logo } from './Logo';

interface RailContentProps {
  expanded: boolean;
  /** Collapse (desktop) or close (drawer). */
  onToggle: () => void;
  /** Called after a destination is chosen; the drawer uses it to close. */
  onNavigate?: () => void;
  /** Drawer shows an X instead of the collapse chevron. */
  drawer?: boolean;
}

const RailContent: React.FC<RailContentProps> = ({
  expanded,
  onToggle,
  onNavigate,
  drawer = false,
}) => {
  const { currentTab, setCurrentTab, agentStatus, pairedDevices } = useAppStore();
  const linkReady = agentStatus.running;

  return (
    <div className="flex h-full flex-col">
      {/* Brand + collapse/close */}
      {expanded ? (
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <Logo size="sm" showText />
          <button
            onClick={onToggle}
            title={drawer ? 'Close navigation' : 'Collapse sidebar'}
            aria-label={drawer ? 'Close navigation' : 'Collapse sidebar'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-slate-500 transition-colors hover:border-white/15 hover:text-slate-200"
          >
            {drawer ? <X size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="mx-auto mt-4 mb-2 rounded-xl transition-transform duration-200 hover:scale-105"
        >
          <Logo size="sm" glow={false} />
        </button>
      )}

      {/* Destinations */}
      <nav
        aria-label="Workspace"
        className={`flex flex-col gap-1 ${expanded ? 'px-3 pt-3' : 'items-center pt-3'}`}
      >
        {expanded && (
          <div className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </div>
        )}

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          const showBadge =
            expanded && item.id === 'dashboard' && pairedDevices.length > 0;

          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                onNavigate?.();
              }}
              aria-current={active ? 'page' : undefined}
              title={expanded ? undefined : item.label}
              className={`group relative flex w-full items-center rounded-xl text-left transition-colors duration-200 ${
                expanded ? 'gap-3 px-2.5 py-2' : 'justify-center py-2'
              } ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.035]'}`}
            >
              {/* Active edge marker */}
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r-full bg-citrus shadow-[0_0_10px_#CAF300]" />
              )}

              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200 ${
                  active
                    ? 'border-citrus/30 bg-citrus/15 text-citrus'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Icon size={17} strokeWidth={1.9} />
              </span>

              {expanded && (
                <>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] font-semibold ${
                        active ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                      {item.description}
                    </span>
                  </span>

                  {showBadge && (
                    <span className="rounded-full border border-citrus/30 bg-citrus/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-citrus">
                      {pairedDevices.length}
                    </span>
                  )}
                </>
              )}

              {/* Rail tooltip */}
              {!expanded && (
                <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-obsidian-950/95 px-2.5 py-1 text-[11px] font-medium text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Link footer — no service controls, this is a status readout */}
      <div
        className={`mt-auto border-t border-white/[0.06] ${
          expanded ? 'p-3' : 'flex flex-col items-center gap-3 px-2 py-4'
        }`}
      >
        {expanded ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                <span className="relative flex h-2 w-2">
                  {linkReady && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-citrus/70" />
                  )}
                  <span
                    className={`relative h-2 w-2 rounded-full ${
                      linkReady ? 'bg-citrus' : 'bg-cyber-amber'
                    }`}
                  />
                </span>
                {linkReady ? 'Link ready' : 'Starting link'}
              </span>
              <span className="font-mono text-[10px] text-slate-600">v0.1.0</span>
            </div>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Smartphone size={13} className={linkReady ? 'text-citrus' : ''} />
                {pairedDevices.length} paired
              </span>
              <span className="flex items-center gap-1.5">
                <Wifi size={13} />
                Local network
              </span>
            </div>
          </div>
        ) : (
          <>
            <span
              title={linkReady ? 'PC link ready' : 'Starting PC link'}
              className={`h-2 w-2 rounded-full ${
                linkReady
                  ? 'bg-citrus shadow-[0_0_8px_#CAF300]'
                  : 'bg-cyber-amber shadow-[0_0_8px_#F59E0B]'
              }`}
            />
            <span
              title={`${pairedDevices.length} paired device${
                pairedDevices.length === 1 ? '' : 's'
              }`}
              className="flex flex-col items-center gap-0.5 font-mono text-[9px] text-slate-400"
            >
              <Smartphone size={14} />
              {pairedDevices.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export const NavSidebar: React.FC = () => {
  const {
    isSidebarExpanded,
    toggleSidebar,
    isMobileNavOpen,
    setMobileNavOpen,
  } = useAppStore();

  // Escape closes the slide-over.
  useEffect(() => {
    if (!isMobileNavOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileNavOpen, setMobileNavOpen]);

  return (
    <>
      {/* Desktop command rail */}
      <aside
        className={`relative z-40 hidden h-full shrink-0 flex-col border-r border-white/[0.06] bg-[#080B10]/80 backdrop-blur-xl transition-[width] duration-300 lg:flex ${
          isSidebarExpanded ? 'w-[248px]' : 'w-[84px]'
        }`}
      >
        <RailContent
          expanded={isSidebarExpanded}
          onToggle={toggleSidebar}
        />
      </aside>

      {/* Slide-over for narrow windows */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${
          isMobileNavOpen ? '' : 'pointer-events-none'
        }`}
        aria-hidden={!isMobileNavOpen}
      >
        <div
          onClick={() => setMobileNavOpen(false)}
          className={`absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-200 ${
            isMobileNavOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[272px] border-r border-white/[0.08] bg-[#080B10] shadow-2xl shadow-black/60 transition-transform duration-300 ${
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <RailContent
            expanded
            drawer
            onToggle={() => setMobileNavOpen(false)}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </aside>
      </div>
    </>
  );
};

import React, { useEffect, useState } from 'react';
import { Smartphone, Radio, Trash2, ArrowUpRight, Cpu, HardDrive } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Card } from '../components/Card';
import { StatusPill } from '../components/StatusPill';
import { agentApi } from '../services/agentApi';
import { SystemMetrics } from '../types';

export const Dashboard: React.FC = () => {
  const { activities, clearActivities, agentStatus, pairedDevices, setCurrentTab } = useAppStore();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (agentStatus.running) {
      agentApi.getSystemMetrics().then(setMetrics);
      timer = setInterval(() => {
        agentApi.getSystemMetrics().then(setMetrics);
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [agentStatus.running]);

  const latestPhone = pairedDevices[0];

  return (
    <div className="space-y-6">
      {/* Top Banner: Phone Watcher Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Phone Connection Monitor */}
        <Card
          title="CONNECTED MOBILE DEVICE"
          subtitle="Real-time Phone Watcher"
          action={
            <StatusPill
              status={pairedDevices.length > 0 ? 'online' : 'standby'}
              label={pairedDevices.length > 0 ? 'PHONE PAIRED' : 'WAITING FOR PHONE'}
              size="sm"
            />
          }
        >
          {pairedDevices.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-citrus/15 text-citrus border border-citrus/30">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{latestPhone?.name || 'Authorized Phone'}</h4>
                  <p className="text-xs font-mono text-slate-400">ID: {latestPhone?.id.slice(0, 12)}...</p>
                </div>
              </div>
              <div className="pt-2 border-t border-obsidian-700/60 grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block">Link State:</span>
                  <span className="text-slate-200">Local Wi-Fi</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Channel:</span>
                  <span className="text-citrus">Encrypted LAN</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center space-y-2">
              <p className="text-xs text-slate-400">No phone currently paired to this workstation.</p>
              <button
                onClick={() => setCurrentTab('pairing')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-citrus text-obsidian-950 font-semibold text-xs hover:bg-citrus-hover transition-colors"
              >
                <span>Pair Phone via QR</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </Card>

        {/* Workstation CPU */}
        <Card title="WORKSTATION PROCESSOR" subtitle="Host Performance">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-obsidian-800 text-slate-300 border border-obsidian-700">
                <Cpu size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {metrics?.cpu_percent !== undefined ? `${metrics.cpu_percent.toFixed(0)}%` : '--'}
                </div>
                <div className="text-xs font-mono text-slate-500">Processor Load</div>
              </div>
            </div>
            <div className="w-20 bg-obsidian-800 rounded-full h-2 overflow-hidden border border-obsidian-700">
              <div
                className="bg-citrus h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, metrics?.cpu_percent || 0))}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Workstation Memory Telemetry */}
        <Card title="WORKSTATION RAM" subtitle="Physical Memory">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-obsidian-800 text-slate-300 border border-obsidian-700">
                <HardDrive size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {metrics?.memory_used_percent !== undefined ? `${metrics.memory_used_percent.toFixed(0)}%` : '--'}
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {metrics?.memory_used_mb && metrics?.memory_total_mb
                    ? `${(metrics.memory_used_mb / 1024).toFixed(1)} / ${(metrics.memory_total_mb / 1024).toFixed(1)} GB`
                    : 'System Memory'}
                </div>
              </div>
            </div>
            <div className="w-20 bg-obsidian-800 rounded-full h-2 overflow-hidden border border-obsidian-700">
              <div
                className="bg-cyber-cyan h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, metrics?.memory_used_percent || 0))}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Real-Time Phone Activity Stream */}
      <Card
        title="LIVE REMOTE ACTIVITY FEED"
        subtitle="Real-time stream of incoming commands from paired mobile devices"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">{activities.length} Events Logged</span>
            {activities.length > 0 && (
              <button
                onClick={clearActivities}
                title="Clear Activity Stream"
                className="p-1 rounded-lg bg-obsidian-800 border border-obsidian-700/60 hover:bg-obsidian-700 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        }
      >
        {activities.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Radio size={28} className="mx-auto text-slate-600 animate-pulse" />
            <h4 className="text-sm font-semibold text-slate-300">Listening for mobile commands</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Touch the trackpad, adjust the master volume, or tap a macro on your phone to watch real-time events appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {activities.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-obsidian-900 border border-obsidian-800 flex items-start justify-between text-xs transition-colors hover:border-obsidian-700"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 p-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider ${
                      item.category === 'input'
                        ? 'bg-citrus/15 text-citrus border border-citrus/30'
                        : item.category === 'volume'
                        ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30'
                        : item.category === 'macro' || item.category === 'power'
                        ? 'bg-cyber-crimson/15 text-cyber-crimson border border-cyber-crimson/30'
                        : 'bg-obsidian-800 text-slate-400 border border-obsidian-700'
                    }`}
                  >
                    {item.category}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">{item.message}</div>
                    {item.detail && <div className="text-slate-400 font-mono text-[11px] mt-0.5">{item.detail}</div>}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap ml-4">{item.timestamp}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

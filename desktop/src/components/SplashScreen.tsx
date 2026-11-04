import React, { useEffect, useState } from 'react';
import { Cpu, Terminal, Radio } from 'lucide-react';
import { Logo } from './Logo';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [stage, setStage] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 250);
    const timer2 = setTimeout(() => setStage(2), 550);
    const timer3 = setTimeout(() => setStage(3), 850);
    const timer4 = setTimeout(() => {
      setFading(true);
      setTimeout(onFinish, 400);
    }, 1150);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onFinish]);

  const checks = [
    { label: 'HOST DAEMON ENGINE', icon: Cpu, done: stage >= 1 },
    { label: 'WIN32 INPUT CONTROLLER', icon: Terminal, done: stage >= 2 },
    { label: 'LAN DISCOVERY SUBSYSTEM', icon: Radio, done: stage >= 3 },
  ];

  return (
    <div
      className={`fixed inset-0 z-[100] bg-obsidian-950 flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-citrus/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6">
        {/* Animated Brand Emblem */}
        <div className="relative mb-6">
          <Logo size="xl" glow={true} className="animate-pulse" />
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-bold text-2xl tracking-[0.2em] text-white font-mono">
            REMOTE DECK
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase mt-1">
            Workstation Control Center
          </p>
        </div>

        {/* Progress Sweep Bar */}
        <div className="w-56 h-1 bg-obsidian-800 rounded-full overflow-hidden mb-6 relative">
          <div
            className="h-full bg-citrus rounded-full transition-all duration-300 ease-out shadow-sm shadow-citrus"
            style={{ width: `${Math.min(100, (stage / 3) * 100)}%` }}
          />
        </div>

        {/* Checklist */}
        <div className="w-full space-y-2 bg-obsidian-900/60 p-3 rounded-xl border border-obsidian-800/80">
          {checks.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center justify-between text-xs font-mono py-1 px-1.5"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    size={13}
                    className={item.done ? 'text-citrus' : 'text-slate-500'}
                  />
                  <span className={item.done ? 'text-slate-300' : 'text-slate-500'}>
                    {item.label}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    item.done
                      ? 'bg-citrus/15 text-citrus'
                      : 'bg-obsidian-800 text-slate-600'
                  }`}
                >
                  {item.done ? 'READY' : 'WAIT'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-8 font-mono text-[10px] text-slate-600 tracking-widest">
          v0.1.0 // INITIALIZED
        </div>
      </div>
    </div>
  );
};

import React from 'react';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  glow?: boolean;
}

const sizeMap = {
  xs: { box: 'w-6 h-6', px: 24, font: 'text-xs' },
  sm: { box: 'w-8 h-8', px: 32, font: 'text-sm' },
  md: { box: 'w-10 h-10', px: 40, font: 'text-base' },
  lg: { box: 'w-16 h-16', px: 64, font: 'text-xl' },
  xl: { box: 'w-24 h-24', px: 96, font: 'text-2xl' },
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  glow = true,
}) => {
  const { box, font } = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`relative ${box} rounded-xl bg-[#090D14] border border-citrus/40 flex items-center justify-center overflow-hidden shrink-0 transition-transform duration-300 hover:scale-105 ${
          glow ? 'shadow-[0_0_15px_rgba(202,243,0,0.2)]' : ''
        }`}
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-0.5"
        >
          <defs>
            <radialGradient id="logoBgGlow" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="60%" stopColor="#0B0F17" />
              <stop offset="100%" stopColor="#05070A" />
            </radialGradient>
            <linearGradient id="logoBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#CAF300" />
              <stop offset="50%" stopColor="#00F0FF" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="logoCitrus" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E2FF4F" />
              <stop offset="100%" stopColor="#CAF300" />
            </linearGradient>
            <linearGradient id="logoCyan" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>

          {/* Background Squircle */}
          <rect
            x="24"
            y="24"
            width="464"
            height="464"
            rx="110"
            fill="url(#logoBgGlow)"
            stroke="url(#logoBorderGrad)"
            strokeWidth="12"
          />

          {/* Decorative Corner Accents */}
          <path d="M 64 120 L 64 64 L 120 64" stroke="#CAF300" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 448 120 L 448 64 L 392 64" stroke="#CAF300" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 64 392 L 64 448 L 120 448" stroke="#00F0FF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 448 392 L 448 448 L 392 448" stroke="#00F0FF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />

          {/* Signal Pulse Waves */}
          <path d="M 190 148 C 228 124 284 124 322 148" stroke="#CAF300" strokeWidth="12" strokeLinecap="round" opacity="0.6" />
          <path d="M 160 118 C 218 84 294 84 352 118" stroke="#CAF300" strokeWidth="10" strokeLinecap="round" opacity="0.3" />

          {/* 'R' Glyph */}
          <path d="M 148 176 L 148 336" stroke="url(#logoCitrus)" strokeWidth="36" strokeLinecap="round" />
          <path d="M 148 176 H 236 C 274 176 296 198 296 230 C 296 262 274 284 236 284 H 148" stroke="url(#logoCitrus)" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 226 284 L 294 336" stroke="url(#logoCitrus)" strokeWidth="36" strokeLinecap="round" />

          {/* 'D' Glyph */}
          <path d="M 284 176 H 324 C 378 176 408 212 408 256 C 408 300 378 336 324 336 H 284" stroke="url(#logoCyan)" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />

          {/* Center Trackpad Signal Node */}
          <circle cx="256" cy="256" r="16" fill="#CAF300" />
          <circle cx="256" cy="256" r="32" stroke="#00F0FF" strokeWidth="6" strokeDasharray="8 6" opacity="0.8" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`font-mono font-black tracking-wider text-slate-100 ${font}`}>
              REMOTE<span className="text-citrus">DECK</span>
            </span>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
            Workstation Control Center
          </span>
        </div>
      )}
    </div>
  );
};

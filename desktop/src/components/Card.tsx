
import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accentColor?: 'citrus' | 'cyan' | 'crimson' | 'emerald';
  pattern?: 'dots' | 'grid' | 'none';
  /** Kept for interface backward-compatibility */
  beam?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  accentColor = 'citrus',
  pattern = 'none',
}) => {
  const accentConfig = {
    citrus: {
      dot: 'bg-[#CAF300] shadow-[0_0_8px_#CAF300]',
    },
    cyan: {
      dot: 'bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]',
    },
    crimson: {
      dot: 'bg-[#FF2A5F] shadow-[0_0_8px_#FF2A5F]',
    },
    emerald: {
      dot: 'bg-[#10B981] shadow-[0_0_8px_#10B981]',
    },
  }[accentColor];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-[#0B0F17]/90 backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] p-5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.5)] transition-colors duration-200 flex flex-col ${className}`}
    >
      {/* Subtle Micro-Pattern Overlay if explicitly requested */}
      {pattern === 'dots' && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
      )}

      {pattern === 'grid' && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      )}

      {/* Top Edge Highlight */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Card Header */}
      {(title || subtitle || action) && (
        <div className="relative z-10 flex items-start justify-between pb-3.5 mb-4 border-b border-white/[0.06]">
          <div>
            {title && (
              <h3 className="text-[11px] font-bold font-mono tracking-[0.14em] text-slate-200 uppercase flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${accentConfig.dot}`} />
                {title}
              </h3>
            )}

            {subtitle && (
              <p className="text-[11px] font-mono text-slate-400/90 mt-1 tracking-tight">
                {subtitle}
              </p>
            )}
          </div>

          {action && <div className="relative z-10">{action}</div>}
        </div>
      )}

      {/* Card Body */}
      <div className="relative z-10 flex-1 flex flex-col justify-between">
        {children}
      </div>
    </div>
  );
};

export default Card;

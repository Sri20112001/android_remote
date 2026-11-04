import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, action, children, className = '' }) => {
  return (
    <div
      className={`bg-[#0F141E]/90 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-xl shadow-black/30 transition-all duration-300 hover:border-white/10 flex flex-col ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/5">
          <div>
            {title && (
              <h3 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-citrus shadow-[0_0_6px_#CAF300]" />
                {title}
              </h3>
            )}
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
};

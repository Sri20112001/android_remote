import React from 'react';

interface StatusPillProps {
  status: 'online' | 'offline' | 'active' | 'standby';
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label, size = 'md' }) => {
  const configs = {
    online: {
      dot: 'bg-citrus',
      bg: 'bg-citrus/10 text-citrus border-citrus/30',
      defaultLabel: 'ONLINE',
    },
    active: {
      dot: 'bg-cyber-cyan',
      bg: 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30',
      defaultLabel: 'ACTIVE',
    },
    standby: {
      dot: 'bg-cyber-amber',
      bg: 'bg-cyber-amber/10 text-cyber-amber border-cyber-amber/30',
      defaultLabel: 'STANDBY',
    },
    offline: {
      dot: 'bg-cyber-crimson',
      bg: 'bg-cyber-crimson/10 text-cyber-crimson border-cyber-crimson/30',
      defaultLabel: 'OFFLINE',
    },
  };

  const config = configs[status] || configs.offline;
  const text = label || config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-full border ${config.bg} ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      {text}
    </span>
  );
};

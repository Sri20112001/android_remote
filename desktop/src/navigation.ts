import { Activity, Inbox, QrCode, Settings, type LucideIcon } from 'lucide-react';

import type { ActiveTab } from './stores/useAppStore';

export interface NavItem {
  id: ActiveTab;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Single source of truth for the workspace navigation. The sidebar renders
 * it as a command rail; the header uses it for the current-page breadcrumb.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    description: 'Link & activity',
    icon: Activity,
  },
  {
    id: 'pairing',
    label: 'Pairing',
    description: 'QR code & PIN',
    icon: QrCode,
  },
  {
    id: 'files',
    label: 'File Beam',
    description: 'Drops from your phone',
    icon: Inbox,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Service & devices',
    icon: Settings,
  },
];

export function navItemFor(tab: ActiveTab): NavItem {
  return NAV_ITEMS.find((item) => item.id === tab) ?? NAV_ITEMS[0];
}

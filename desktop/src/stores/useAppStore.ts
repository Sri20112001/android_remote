import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ActivityEvent, AgentHealthResponse, AgentStatusInfo, BeamedFile, DiscoveryQRResponse, PairedDevice } from '../types';
import { agentApi } from '../services/agentApi';
import { wsService } from '../services/websocketService';

export type ActiveTab = 'dashboard' | 'pairing' | 'files' | 'settings';

interface AppState {
  currentTab: ActiveTab;
  setCurrentTab: (tab: ActiveTab) => void;
  isSidebarExpanded: boolean;
  toggleSidebar: () => void;

  // Agent Status
  agentStatus: AgentStatusInfo;
  agentHealth: AgentHealthResponse | null;
  isStartingAgent: boolean;
  isStoppingAgent: boolean;
  refreshAgentStatus: () => Promise<void>;
  startAgent: () => Promise<string>;
  stopAgent: () => Promise<string>;
  restartAgent: () => Promise<string>;

  // Pairing & Devices
  discoveryQR: DiscoveryQRResponse | null;
  pairedDevices: PairedDevice[];
  isLoadingPairing: boolean;
  fetchPairingData: (forceRegenerate?: boolean) => Promise<void>;
  revokeDevice: (id: string) => Promise<boolean>;

  // Activity Stream (Phone Watcher)
  activities: ActivityEvent[];
  addActivity: (event: ActivityEvent) => void;
  clearActivities: () => void;
  isWsConnected: boolean;

  // Beamed Files
  beamedFiles: BeamedFile[];
  fetchBeamedFiles: () => Promise<void>;
  openFileInExplorer: (path: string) => Promise<void>;
  openDownloadsFolder: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'dashboard',
  setCurrentTab: (tab) => set({ currentTab: tab }),
  isSidebarExpanded: true,
  toggleSidebar: () => set((s) => ({ isSidebarExpanded: !s.isSidebarExpanded })),

  agentStatus: {
    running: false,
    port: 8765,
    host: '127.0.0.1',
    executable_found: false,
    executable_path: null,
  },
  agentHealth: null,
  isStartingAgent: false,
  isStoppingAgent: false,

  refreshAgentStatus: async () => {
    try {
      const status = await invoke<AgentStatusInfo>('get_agent_status');
      set({ agentStatus: status });

      if (status.running) {
        const health = await agentApi.getHealth();
        set({ agentHealth: health });
        wsService.connect();
      } else {
        set({ agentHealth: null });
      }
    } catch (e) {
      console.error('Error fetching agent status:', e);
    }
  },

  startAgent: async () => {
    set({ isStartingAgent: true });
    try {
      const res = await invoke<string>('start_agent');
      await new Promise((r) => setTimeout(r, 800));
      await get().refreshAgentStatus();
      get().addActivity({
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        category: 'system',
        message: 'Host daemon started',
        detail: res,
      });
      return res;
    } finally {
      set({ isStartingAgent: false });
    }
  },

  stopAgent: async () => {
    set({ isStoppingAgent: true });
    try {
      const res = await invoke<string>('stop_agent');
      await new Promise((r) => setTimeout(r, 400));
      await get().refreshAgentStatus();
      get().addActivity({
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        category: 'system',
        message: 'Host daemon stopped',
        detail: res,
      });
      return res;
    } finally {
      set({ isStoppingAgent: false });
    }
  },

  restartAgent: async () => {
    set({ isStartingAgent: true });
    try {
      const res = await invoke<string>('restart_agent');
      await new Promise((r) => setTimeout(r, 900));
      await get().refreshAgentStatus();
      get().addActivity({
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        category: 'system',
        message: 'Host daemon restarted',
        detail: res,
      });
      return res;
    } finally {
      set({ isStartingAgent: false });
    }
  },

  discoveryQR: null,
  pairedDevices: [],
  isLoadingPairing: false,

  fetchPairingData: async (forceRegenerate = false) => {
    // If a session already exists and forceRegenerate is false, do not burn/replace the active PIN
    if (!forceRegenerate && get().discoveryQR?.pin) {
      try {
        const devices = await agentApi.getPairedDevices();
        set({ pairedDevices: devices });
      } catch (err) {
        console.warn('Failed to refresh paired devices:', err);
      }
      return;
    }

    set({ isLoadingPairing: true });
    try {
      // Direct Native Rust Invoke: auto-starts daemon if stopped & gets QR JSON
      const res = await invoke<{ pin: string; qr_payload: string }>('get_pairing_session');
      const devices = await agentApi.getPairedDevices();
      set({
        discoveryQR: {
          pin: res.pin,
          qr_payload: res.qr_payload,
          expires_in_seconds: 300,
        },
        pairedDevices: devices,
      });
      get().refreshAgentStatus();
    } catch (e) {
      console.warn('Native pairing call error, attempting loopback fallback:', e);
      try {
        const [qr, devices] = await Promise.all([
          agentApi.startPairingSession(),
          agentApi.getPairedDevices(),
        ]);
        set({ discoveryQR: qr, pairedDevices: devices });
      } catch (err) {
        console.error('Pairing fallback error:', err);
      }
    } finally {
      set({ isLoadingPairing: false });
    }
  },

  revokeDevice: async (id: string) => {
    const success = await agentApi.revokeDevice(id);
    if (success) {
      await get().fetchPairingData();
      get().addActivity({
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        category: 'auth',
        message: `Device revoked: ${id}`,
      });
    }
    return success;
  },

  activities: [],
  addActivity: (event) =>
    set((state) => ({
      activities: [event, ...state.activities.slice(0, 49)],
    })),
  clearActivities: () => set({ activities: [] }),
  isWsConnected: false,

  beamedFiles: [],
  fetchBeamedFiles: async () => {
    try {
      const files = await invoke<BeamedFile[]>('get_beamed_files');
      set({ beamedFiles: files });
    } catch (e) {
      console.error('Error fetching beamed files:', e);
    }
  },

  openFileInExplorer: async (path: string) => {
    try {
      await invoke('open_file_in_explorer', { filePath: path });
    } catch (e) {
      console.error('Error opening file in explorer:', e);
    }
  },

  openDownloadsFolder: async () => {
    try {
      await invoke('open_downloads_folder');
    } catch (e) {
      console.error('Error opening downloads folder:', e);
    }
  },
}));

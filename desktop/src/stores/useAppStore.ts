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
  /** Slide-over navigation for windows narrower than the `lg` breakpoint. */
  isMobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;

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
  onlineDeviceIds: string[];
  setDeviceOnline: (id: string, online: boolean) => void;
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
  addBeamedFile: (file: BeamedFile) => void;
  fetchBeamedFiles: () => Promise<void>;
  openFileInExplorer: (path: string) => Promise<void>;
  openDownloadsFolder: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'dashboard',
  setCurrentTab: (tab) => set({ currentTab: tab }),
  isSidebarExpanded: true,
  toggleSidebar: () => set((s) => ({ isSidebarExpanded: !s.isSidebarExpanded })),
  isMobileNavOpen: false,
  setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),

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
        message: 'PC link service started',
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
        message: 'PC link service stopped',
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
        message: 'PC link service restarted',
        detail: res,
      });
      return res;
    } finally {
      set({ isStartingAgent: false });
    }
  },

  discoveryQR: null,
  pairedDevices: [],
  onlineDeviceIds: [],
  setDeviceOnline: (id: string, online: boolean) =>
    set((state) => ({
      onlineDeviceIds: online
        ? Array.from(new Set([...state.onlineDeviceIds, id]))
        : state.onlineDeviceIds.filter((dId) => dId !== id),
      pairedDevices: state.pairedDevices.map((d) =>
        d.id === id ? { ...d, is_online: online } : d
      ),
    })),
  isLoadingPairing: false,

  fetchPairingData: async (forceRegenerate = false) => {
    // If a session already exists and forceRegenerate is false, do not burn/replace the active PIN
    if (!forceRegenerate && get().discoveryQR?.pin) {
      try {
        const devices = await agentApi.getPairedDevices();
        const currentOnline = new Set(get().onlineDeviceIds);
        // On app startup, determine online state based on recent last_seen_at or active stream
        const now = Date.now();
        const enriched = devices.map((d) => {
          let isOnline = currentOnline.has(d.id);
          if (d.last_seen_at) {
            const seenTime = new Date(d.last_seen_at).getTime();
            // If seen within last 2 minutes
            if (!isNaN(seenTime) && now - seenTime < 120_000) {
              isOnline = true;
              currentOnline.add(d.id);
            }
          }
          return { ...d, is_online: isOnline };
        });
        set({ pairedDevices: enriched, onlineDeviceIds: Array.from(currentOnline) });
      } catch (err) {
        console.warn('Failed to refresh paired devices:', err);
      }
      return;
    }

    set({ isLoadingPairing: true });
    try {
      // Direct Native Rust Invoke: auto-starts the link service if stopped & gets QR JSON
      const res = await invoke<{ pin: string; qr_payload: string }>('get_pairing_session');
      const devices = await agentApi.getPairedDevices();
      const currentOnline = new Set(get().onlineDeviceIds);
      const now = Date.now();
      const enriched = devices.map((d) => {
        let isOnline = currentOnline.has(d.id);
        if (d.last_seen_at) {
          const seenTime = new Date(d.last_seen_at).getTime();
          if (!isNaN(seenTime) && now - seenTime < 120_000) {
            isOnline = true;
            currentOnline.add(d.id);
          }
        }
        return { ...d, is_online: isOnline };
      });
      set({
        discoveryQR: {
          pin: res.pin,
          qr_payload: res.qr_payload,
          expires_in_seconds: 300,
        },
        pairedDevices: enriched,
        onlineDeviceIds: Array.from(currentOnline),
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
        message: `Device revoked`,
        detail: `Device removed from authorized list`,
      });
    }
    return success;
  },

  activities: [],
  addActivity: (event) =>
    set((state) => {
      // When a remote input / command event arrives from a mobile phone, mark the phone as active online!
      let updatedDevices = state.pairedDevices;
      let updatedOnline = state.onlineDeviceIds;
      if (['input', 'volume', 'macro', 'power'].includes(event.category) && state.pairedDevices.length > 0) {
        const primaryId = state.pairedDevices[0].id;
        if (!state.onlineDeviceIds.includes(primaryId)) {
          updatedOnline = [...state.onlineDeviceIds, primaryId];
        }
        updatedDevices = state.pairedDevices.map((d, idx) =>
          idx === 0
            ? { ...d, is_online: true, last_seen_at: new Date().toISOString() }
            : d
        );
      }
      return {
        activities: [event, ...state.activities.slice(0, 49)],
        pairedDevices: updatedDevices,
        onlineDeviceIds: updatedOnline,
      };
    }),
  clearActivities: () => set({ activities: [] }),
  isWsConnected: false,

  beamedFiles: [],
  addBeamedFile: (file) =>
    set((state) => ({
      beamedFiles: [file, ...state.beamedFiles.filter((f) => f.path !== file.path)],
    })),
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

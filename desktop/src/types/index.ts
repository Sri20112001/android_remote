export interface AgentStatusInfo {
  running: boolean;
  port: u16 | number;
  host: string;
  executable_found: boolean;
  executable_path: string | null;
}

export type u16 = number;

export interface AgentHealthResponse {
  status: string;
  version?: string;
  uptime_seconds?: number;
}

export interface PairedDevice {
  id: string;
  name: string;
  paired_at: string;
  last_seen_at?: string;
  last_used?: string;
  platform?: string;
  model?: string;
  os_version?: string;
  status?: string;
  is_online?: boolean;
  ip?: string;
}

export interface DiscoveryQRResponse {
  pin: string;
  qr_payload: string;
  expires_in_seconds?: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  category: 'input' | 'macro' | 'volume' | 'power' | 'file' | 'system' | 'auth';
  message: string;
  detail?: string;
}

export interface BeamedFile {
  name: string;
  path: string;
  size_bytes: number;
  modified_timestamp: number;
}

export interface SystemMetrics {
  cpu?: {
    usage_percent: number;
  };
  memory?: {
    total_bytes: number;
    available_bytes: number;
    used_bytes: number;
    usage_percent: number;
  };
  battery?: {
    present: boolean;
    charging: boolean;
    percentage: number;
    life_time_seconds?: number;
  };
  disks?: {
    mount: string;
    total_bytes: number;
    free_bytes: number;
    used_bytes: number;
    usage_percent: number;
  }[];
  cpu_percent?: number;
  memory_used_percent?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
}

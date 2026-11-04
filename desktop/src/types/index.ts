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
  last_used?: string;
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
  cpu_percent?: number;
  memory_used_percent?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
}

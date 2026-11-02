export interface WSFrame {
  type: 'command' | 'response' | 'event' | 'ping' | 'pong' | 'error';
  id?: string;
  module?: string;
  action?: string;
  payload?: any;
  success?: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
  event?: string;
  ts?: number;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export class AgentWSClient {
  private ws: WebSocket | null = null;
  private origin: string;
  private token: string;
  private state: ConnectionState = 'disconnected';
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private correlationMap = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }>();
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private idCounter = 1;
  private shouldReconnect = true;

  constructor(origin: string, token: string) {
    this.origin = origin;
    this.token = token;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldReconnect = true;
    this.setState('connecting');

    const wsUrl = `${this.origin.replace(/^http/i, 'ws')}/api/v1/ws?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setState('connected');
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const frame: WSFrame = JSON.parse(event.data);
          this.handleFrame(frame);
        } catch (e) {
          console.warn('[WS] Parse error:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.warn('[WS] Error:', e);
        this.setState('error');
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.stopPing();
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn('[WS] Connection exception:', err);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public on(event: string, handler: (data: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  public send(frame: Partial<WSFrame>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    if (!frame.id) {
      frame.id = `f_${this.idCounter++}_${Date.now()}`;
    }
    this.ws.send(JSON.stringify(frame));
  }

  public sendCommand<T = any>(module: string, action: string, payload?: any): Promise<T> {
    const id = `cmd_${this.idCounter++}_${Date.now()}`;
    const frame: WSFrame = {
      type: 'command',
      id,
      module,
      action,
      payload,
      ts: Date.now(),
    };

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not connected'));
      }

      const timer = setTimeout(() => {
        this.correlationMap.delete(id);
        reject(new Error(`Command ${module}.${action} timed out`));
      }, 5000);

      this.correlationMap.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify(frame));
    });
  }

  private handleFrame(frame: WSFrame): void {
    if (frame.type === 'response' && frame.id) {
      const handler = this.correlationMap.get(frame.id);
      if (handler) {
        clearTimeout(handler.timer);
        this.correlationMap.delete(frame.id);
        if (frame.success === false || frame.error) {
          handler.reject(new Error(frame.error?.message || 'Operation failed'));
        } else {
          handler.resolve(frame.data);
        }
      }
    } else if (frame.type === 'event' && frame.event) {
      const listeners = this.eventListeners.get(frame.event);
      if (listeners) {
        listeners.forEach((fn) => fn(frame.data));
      }
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', ts: Date.now() });
    }, 15000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, 2000);
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.stateListeners.forEach((fn) => fn(state));
    }
  }
}

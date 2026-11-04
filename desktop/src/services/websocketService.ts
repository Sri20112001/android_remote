import { ActivityEvent } from '../types';

type EventListener = (event: ActivityEvent) => void;
type ConnectionListener = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventListeners: Set<EventListener> = new Set();
  private connectionListeners: Set<ConnectionListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket('ws://127.0.0.1:8765/ws');

      this.ws.onopen = () => {
        this.notifyConnection(true);
        this.emitActivity({
          category: 'system',
          message: 'Connected to local agent WebSocket stream',
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch {
          // Plain message
          this.emitActivity({
            category: 'system',
            message: `Stream data: ${String(event.data).slice(0, 80)}`,
          });
        }
      };

      this.ws.onclose = () => {
        this.notifyConnection(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {};
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(data: any) {

    if (data.type === 'input' || data.module === 'input') {
      const action = data.action || data.subaction || 'input command';
      this.emitActivity({
        category: 'input',
        message: `Remote Input: ${action}`,
        detail: JSON.stringify(data.payload || data).slice(0, 100),
      });
    } else if (data.type === 'audio' || data.module === 'audio') {
      this.emitActivity({
        category: 'volume',
        message: `Audio Adjustment`,
        detail: data.level !== undefined ? `Level: ${data.level}%` : 'Mute toggled',
      });
    } else if (data.type === 'power' || data.module === 'power') {
      this.emitActivity({
        category: 'power',
        message: `Power command requested`,
        detail: data.action || 'Workstation power event',
      });
    } else if (data.type === 'clipboard' || data.module === 'clipboard') {
      this.emitActivity({
        category: 'system',
        message: `Clipboard synchronization event`,
      });
    } else {
      this.emitActivity({
        category: 'system',
        message: `Agent Event: ${data.type || data.topic || 'metric'}`,
        detail: typeof data === 'object' ? JSON.stringify(data).slice(0, 90) : String(data),
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public onActivity(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.ws?.readyState === WebSocket.OPEN);
    return () => this.connectionListeners.delete(listener);
  }

  private notifyConnection(connected: boolean) {
    this.connectionListeners.forEach((l) => l(connected));
  }

  public emitActivity(partial: Omit<ActivityEvent, 'id' | 'timestamp'>) {
    const event: ActivityEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      ...partial,
    };
    this.eventListeners.forEach((l) => l(event));
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsService = new WebSocketService();

import type {
  ClientWsMessage,
  PublicRoomSummary,
  RoomSettings,
  RoomStatePayload,
  ServerWsMessage,
} from './netTypes.ts';
import type { ReplayFrame } from './replay.ts';
import type { FighterArchetypeId, MatchResultSummary, PlayerInput } from './types.ts';

export interface OnlineClientCallbacks {
  onStatusChange?: (connected: boolean) => void;
  onRoomState?: (room: RoomStatePayload | null, clientId: string | null, mySlot: number) => void;
  onMatchStarted?: (room: RoomStatePayload, mySlot: number) => void;
  onSimSnapshot?: (frame: ReplayFrame) => void;
  onMatchOver?: (result: MatchResultSummary) => void;
  onError?: (message: string) => void;
}

export class OnlineClient {
  private ws: WebSocket | null = null;
  private callbacks: OnlineClientCallbacks = {};
  public clientId: string | null = null;
  public mySlot = 0;
  public currentRoom: RoomStatePayload | null = null;
  public connected = false;
  private pendingQueue: ClientWsMessage[] = [];

  public setCallbacks(cb: OnlineClientCallbacks): void {
    this.callbacks = cb;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.callbacks.onStatusChange?.(true);
      while (this.pendingQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = this.pendingQueue.shift()!;
        ws.send(JSON.stringify(msg));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as ServerWsMessage;
        this.handleMessage(msg);
      } catch {
        // ignore malformed packets
      }
    };

    ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.callbacks.onStatusChange?.(false);
    };

    ws.onerror = () => {
      this.callbacks.onError?.('Unable to reach multiplayer WebSocket server.');
    };
  }

  private handleMessage(msg: ServerWsMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.clientId = msg.clientId;
        break;
      case 'room_state':
        this.clientId = msg.yourClientId;
        this.mySlot = msg.yourSlot;
        this.currentRoom = msg.room;
        this.callbacks.onRoomState?.(msg.room, msg.yourClientId, msg.yourSlot);
        break;
      case 'match_started':
        this.mySlot = msg.yourSlot;
        this.currentRoom = msg.room;
        this.callbacks.onMatchStarted?.(msg.room, msg.yourSlot);
        break;
      case 'sim_snapshot':
        this.callbacks.onSimSnapshot?.(msg.frame);
        break;
      case 'match_over':
        this.callbacks.onMatchOver?.(msg.result);
        break;
      case 'room_left':
        this.currentRoom = null;
        this.mySlot = 0;
        this.callbacks.onRoomState?.(null, this.clientId, 0);
        break;
      case 'error':
        this.callbacks.onError?.(msg.message);
        break;
    }
  }

  public send(msg: ClientWsMessage): void {
    this.connect();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.pendingQueue.push(msg);
    }
  }

  public createRoom(
    name: string,
    archetypeId: FighterArchetypeId,
    settings: Partial<RoomSettings>
  ): void {
    this.send({ type: 'create_room', name, archetypeId, settings });
  }

  public joinRoom(code: string, name: string, archetypeId: FighterArchetypeId): void {
    this.send({ type: 'join_room', code, name, archetypeId });
  }

  public leaveRoom(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave_room' }));
    }
    this.currentRoom = null;
  }

  public updatePlayer(patch: {
    name?: string;
    archetypeId?: FighterArchetypeId;
    teamId?: 0 | 1 | null;
  }): void {
    this.send({ type: 'update_player', ...patch });
  }

  public updateSettings(settings: Partial<RoomSettings>): void {
    this.send({ type: 'update_settings', settings });
  }

  public toggleReady(ready?: boolean): void {
    this.send({ type: 'toggle_ready', ready });
  }

  public startMatch(): void {
    this.send({ type: 'start_match' });
  }

  public rematch(): void {
    this.send({ type: 'rematch' });
  }

  public sendInput(input: PlayerInput): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'player_input', input }));
    }
  }

  public async fetchRooms(): Promise<PublicRoomSummary[]> {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return [];
      const json = (await res.json()) as { rooms?: PublicRoomSummary[] };
      return Array.isArray(json.rooms) ? json.rooms : [];
    } catch {
      return [];
    }
  }
}

export const onlineClient = new OnlineClient();

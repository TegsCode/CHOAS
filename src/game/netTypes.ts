import type { ReplayFrame } from './replay.ts';
import type {
  ArenaId,
  FighterArchetypeId,
  GameMode,
  MatchResultSummary,
  PlayerInput,
} from './types.ts';

export interface RoomSettings {
  arenaId: ArenaId;
  gameMode: GameMode;
  maxPlayers: number; // 2..8
  fillWithBots: boolean;
}

export interface RoomPlayerInfo {
  clientId: string;
  slot: number;
  name: string;
  archetypeId: FighterArchetypeId;
  teamId: 0 | 1 | null;
  ready: boolean;
  isHost: boolean;
}

export interface RoomStatePayload {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  players: RoomPlayerInfo[];
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  arenaId: ArenaId;
  gameMode: GameMode;
  playerCount: number;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
}

export type ClientWsMessage =
  | {
      type: 'create_room';
      name: string;
      archetypeId: FighterArchetypeId;
      settings?: Partial<RoomSettings>;
    }
  | {
      type: 'join_room';
      code: string;
      name: string;
      archetypeId: FighterArchetypeId;
    }
  | { type: 'leave_room' }
  | {
      type: 'update_player';
      name?: string;
      archetypeId?: FighterArchetypeId;
      teamId?: 0 | 1 | null;
    }
  | {
      type: 'update_settings';
      settings: Partial<RoomSettings>;
    }
  | { type: 'toggle_ready'; ready?: boolean }
  | { type: 'start_match' }
  | { type: 'rematch' }
  | { type: 'player_input'; input: PlayerInput };

export type ServerWsMessage =
  | { type: 'welcome'; clientId: string }
  | { type: 'room_state'; room: RoomStatePayload; yourClientId: string; yourSlot: number }
  | { type: 'match_started'; room: RoomStatePayload; yourSlot: number }
  | { type: 'sim_snapshot'; frame: ReplayFrame }
  | { type: 'match_over'; result: MatchResultSummary }
  | { type: 'room_left' }
  | { type: 'error'; message: string };

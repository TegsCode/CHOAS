import { computeAiInput } from './ai.ts';
import {
  createArenaConfig,
  FIGHTER_ARCHETYPES,
  GAME_MODES,
  PLAYABLE_ARENAS,
} from './constants.ts';
import type {
  ClientWsMessage,
  PublicRoomSummary,
  RoomPlayerInfo,
  RoomSettings,
  RoomStatePayload,
  ServerWsMessage,
} from './netTypes.ts';
import {
  buildMatchResult,
  createSimulation,
  EMPTY_INPUT,
  stepSimulation,
} from './physics.ts';
import { captureReplayFrame } from './replay.ts';
import type {
  ArenaId,
  FighterArchetypeId,
  GameMode,
  PlayerInput,
  SimEvent,
  SimulationState,
} from './types.ts';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 64;
const MAX_PLAYERS = 8;

const VALID_ARCHETYPE_IDS = new Set<string>(FIGHTER_ARCHETYPES.map((a) => a.id));
const VALID_ARENA_IDS = new Set<string>(PLAYABLE_ARENAS);
const VALID_GAME_MODES = new Set<string>(GAME_MODES.map((m) => m.id));

export function sanitizePlayerName(raw: unknown, fallback = 'Fighter'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw
    .replace(/[<>&"'`\r\n\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return cleaned.length >= 1 ? cleaned : fallback;
}

export function sanitizeArchetypeId(raw: unknown): FighterArchetypeId {
  if (typeof raw === 'string' && VALID_ARCHETYPE_IDS.has(raw)) {
    return raw as FighterArchetypeId;
  }
  return 'ember';
}

export function clampPlayerInput(raw: unknown): PlayerInput {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_INPUT };
  const r = raw as Record<string, unknown>;
  const clampAxis = (v: unknown) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
    return n < -1 ? -1 : n > 1 ? 1 : n;
  };
  let aimX: number | undefined;
  let aimY: number | undefined;
  if (typeof r.aimX === 'number' && Number.isFinite(r.aimX) && typeof r.aimY === 'number' && Number.isFinite(r.aimY)) {
    const len = Math.hypot(r.aimX, r.aimY);
    if (len > 0.01) {
      aimX = r.aimX / len;
      aimY = r.aimY / len;
    }
  }
  return {
    moveX: clampAxis(r.moveX),
    moveY: clampAxis(r.moveY),
    jumpHeld: Boolean(r.jumpHeld),
    jumpPressed: Boolean(r.jumpPressed),
    dashPressed: Boolean(r.dashPressed),
    slideHeld: Boolean(r.slideHeld),
    slidePressed: Boolean(r.slidePressed),
    grappleHeld: Boolean(r.grappleHeld),
    grapplePressed: Boolean(r.grapplePressed),
    pullHeld: Boolean(r.pullHeld),
    divePressed: Boolean(r.divePressed),
    attackPressed: Boolean(r.attackPressed),
    defendHeld: Boolean(r.defendHeld),
    aimX,
    aimY,
  };
}

export function sanitizeRoomSettings(
  current: RoomSettings,
  patch?: Partial<RoomSettings>
): RoomSettings {
  if (!patch) return current;
  const arenaId: ArenaId =
    typeof patch.arenaId === 'string' && VALID_ARENA_IDS.has(patch.arenaId)
      ? (patch.arenaId as ArenaId)
      : current.arenaId;
  const gameMode: GameMode =
    typeof patch.gameMode === 'string' && VALID_GAME_MODES.has(patch.gameMode)
      ? (patch.gameMode as GameMode)
      : current.gameMode;
  const rawMax =
    typeof patch.maxPlayers === 'number' && Number.isFinite(patch.maxPlayers)
      ? Math.round(patch.maxPlayers)
      : current.maxPlayers;
  const maxPlayers = Math.max(2, Math.min(MAX_PLAYERS, rawMax));
  const fillWithBots =
    typeof patch.fillWithBots === 'boolean' ? patch.fillWithBots : current.fillWithBots;

  return { arenaId, gameMode, maxPlayers, fillWithBots };
}

export interface RoomMember extends RoomPlayerInfo {
  heldInput: PlayerInput;
  pendingEdges: {
    jumpPressed: boolean;
    dashPressed: boolean;
    slidePressed: boolean;
    grapplePressed: boolean;
    divePressed: boolean;
    attackPressed: boolean;
  };
}

export interface GameRoom {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  players: RoomMember[];
  sim: SimulationState | null;
  tickCount: number;
  pendingEvents: SimEvent[];
}

export type SendMessageFn = (clientId: string, msg: ServerWsMessage) => void;

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private clientRoomMap = new Map<string, string>();
  private sendFn: SendMessageFn;

  constructor(sendFn: SendMessageFn) {
    this.sendFn = sendFn;
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 40; attempt++) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return `R${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }

  public getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public hasActivePlayingRooms(): boolean {
    for (const room of this.rooms.values()) {
      if (room.status === 'playing' && room.sim) return true;
    }
    return false;
  }

  public getPublicRooms(): PublicRoomSummary[] {
    const list: PublicRoomSummary[] = [];
    for (const room of this.rooms.values()) {
      const host = room.players.find((p) => p.isHost) ?? room.players[0];
      list.push({
        code: room.code,
        hostName: host?.name ?? 'Host',
        arenaId: room.settings.arenaId,
        gameMode: room.settings.gameMode,
        playerCount: room.players.length,
        maxPlayers: room.settings.maxPlayers,
        status: room.status,
      });
    }
    return list;
  }

  private toPayload(room: GameRoom): RoomStatePayload {
    return {
      code: room.code,
      status: room.status,
      settings: { ...room.settings },
      players: room.players.map((p) => ({
        clientId: p.clientId,
        slot: p.slot,
        name: p.name,
        archetypeId: p.archetypeId,
        teamId: p.teamId,
        ready: p.ready,
        isHost: p.isHost,
      })),
    };
  }

  private broadcastRoomState(room: GameRoom): void {
    const payload = this.toPayload(room);
    for (const p of room.players) {
      this.sendFn(p.clientId, {
        type: 'room_state',
        room: payload,
        yourClientId: p.clientId,
        yourSlot: p.slot,
      });
    }
  }

  private createMember(
    clientId: string,
    slot: number,
    name: string,
    archetypeId: FighterArchetypeId,
    isHost: boolean
  ): RoomMember {
    return {
      clientId,
      slot,
      name,
      archetypeId,
      teamId: (slot % 2) as 0 | 1,
      ready: isHost,
      isHost,
      heldInput: { ...EMPTY_INPUT },
      pendingEdges: {
        jumpPressed: false,
        dashPressed: false,
        slidePressed: false,
        grapplePressed: false,
        divePressed: false,
        attackPressed: false,
      },
    };
  }

  private nextAvailableSlot(room: GameRoom): number {
    const used = new Set(room.players.map((p) => p.slot));
    for (let s = 0; s < room.settings.maxPlayers; s++) {
      if (!used.has(s)) return s;
    }
    return room.players.length;
  }

  public handleClientMessage(clientId: string, msg: ClientWsMessage): void {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'create_room': {
        this.leaveRoom(clientId, false);
        if (this.rooms.size >= MAX_ROOMS) {
          this.sendFn(clientId, { type: 'error', message: 'Server room capacity reached.' });
          return;
        }
        const code = this.generateCode();
        const settings = sanitizeRoomSettings(
          {
            arenaId: 'meadow',
            gameMode: 'stock_brawl',
            maxPlayers: 4,
            fillWithBots: true,
          },
          msg.settings
        );
        const member = this.createMember(
          clientId,
          0,
          sanitizePlayerName(msg.name, 'Host'),
          sanitizeArchetypeId(msg.archetypeId),
          true
        );
        const room: GameRoom = {
          code,
          status: 'lobby',
          settings,
          players: [member],
          sim: null,
          tickCount: 0,
          pendingEvents: [],
        };
        this.rooms.set(code, room);
        this.clientRoomMap.set(clientId, code);
        this.broadcastRoomState(room);
        break;
      }

      case 'join_room': {
        const code = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
        const room = this.rooms.get(code);
        if (!room) {
          this.sendFn(clientId, { type: 'error', message: `Room "${code}" not found.` });
          return;
        }
        if (room.status === 'playing') {
          this.sendFn(clientId, {
            type: 'error',
            message: 'Match is already in progress in that room.',
          });
          return;
        }
        if (room.players.length >= room.settings.maxPlayers) {
          this.sendFn(clientId, { type: 'error', message: 'Room is full.' });
          return;
        }
        this.leaveRoom(clientId, false);
        const slot = this.nextAvailableSlot(room);
        const member = this.createMember(
          clientId,
          slot,
          sanitizePlayerName(msg.name, `Fighter ${slot + 1}`),
          sanitizeArchetypeId(msg.archetypeId),
          false
        );
        room.players.push(member);
        this.clientRoomMap.set(clientId, code);
        this.broadcastRoomState(room);
        break;
      }

      case 'leave_room': {
        this.leaveRoom(clientId, true);
        break;
      }

      case 'update_player': {
        const room = this.getClientRoom(clientId);
        if (!room || room.status !== 'lobby') return;
        const member = room.players.find((p) => p.clientId === clientId);
        if (!member) return;
        if (msg.name !== undefined) member.name = sanitizePlayerName(msg.name, member.name);
        if (msg.archetypeId !== undefined) member.archetypeId = sanitizeArchetypeId(msg.archetypeId);
        if (msg.teamId === 0 || msg.teamId === 1) member.teamId = msg.teamId;
        this.broadcastRoomState(room);
        break;
      }

      case 'update_settings': {
        const room = this.getClientRoom(clientId);
        if (!room || room.status !== 'lobby') return;
        const member = room.players.find((p) => p.clientId === clientId);
        if (!member?.isHost) return;
        room.settings = sanitizeRoomSettings(room.settings, msg.settings);
        this.broadcastRoomState(room);
        break;
      }

      case 'toggle_ready': {
        const room = this.getClientRoom(clientId);
        if (!room || room.status !== 'lobby') return;
        const member = room.players.find((p) => p.clientId === clientId);
        if (!member) return;
        member.ready = typeof msg.ready === 'boolean' ? msg.ready : !member.ready;
        this.broadcastRoomState(room);
        break;
      }

      case 'start_match': {
        const room = this.getClientRoom(clientId);
        if (!room) return;
        const member = room.players.find((p) => p.clientId === clientId);
        if (!member?.isHost) return;
        this.startRoomMatch(room);
        break;
      }

      case 'rematch': {
        const room = this.getClientRoom(clientId);
        if (!room) return;
        const member = room.players.find((p) => p.clientId === clientId);
        if (!member?.isHost) return;
        room.status = 'lobby';
        room.sim = null;
        room.pendingEvents = [];
        for (const p of room.players) {
          p.ready = p.isHost;
        }
        this.broadcastRoomState(room);
        break;
      }

      case 'player_input': {
        const room = this.getClientRoom(clientId);
        if (!room || room.status !== 'playing') return;
        const member = room.players.find((p) => p.clientId === clientId);
        if (!member) return;
        const clean = clampPlayerInput(msg.input);
        member.heldInput = clean;
        if (clean.jumpPressed) member.pendingEdges.jumpPressed = true;
        if (clean.dashPressed) member.pendingEdges.dashPressed = true;
        if (clean.slidePressed) member.pendingEdges.slidePressed = true;
        if (clean.grapplePressed) member.pendingEdges.grapplePressed = true;
        if (clean.divePressed) member.pendingEdges.divePressed = true;
        if (clean.attackPressed) member.pendingEdges.attackPressed = true;
        break;
      }
    }
  }

  private getClientRoom(clientId: string): GameRoom | undefined {
    const code = this.clientRoomMap.get(clientId);
    return code ? this.rooms.get(code) : undefined;
  }

  public startRoomMatch(room: GameRoom): void {
    const fighterCount = room.settings.fillWithBots
      ? Math.max(2, room.settings.maxPlayers)
      : Math.max(2, room.players.length);

    const sortedPlayers = [...room.players].sort((a, b) => a.slot - b.slot);
    sortedPlayers.forEach((p, idx) => {
      p.slot = idx;
    });

    const sim = createSimulation({
      arenaId: room.settings.arenaId,
      gameMode: room.settings.gameMode,
      fighterCount,
      p1ArchetypeId: sortedPlayers[0]?.archetypeId ?? 'ember',
      customHumans: sortedPlayers.map((p) => ({
        slot: p.slot,
        name: p.name,
        archetypeId: p.archetypeId,
        teamId: p.teamId,
      })),
    });

    room.sim = sim;
    room.status = 'playing';
    room.tickCount = 0;
    room.pendingEvents = [];

    const payload = this.toPayload(room);
    for (const p of room.players) {
      this.sendFn(p.clientId, {
        type: 'match_started',
        room: payload,
        yourSlot: p.slot,
      });
    }
  }

  public stepRooms(dt: number): void {
    for (const room of this.rooms.values()) {
      if (room.status !== 'playing' || !room.sim) continue;
      const sim = room.sim;
      const inputsByFighterId: Record<number, PlayerInput> = {};

      for (const f of sim.fighters) {
        if (!f.alive) continue;
        if (f.isHuman) {
          const member = room.players.find((p) => p.slot === f.playerSlot);
          if (member) {
            inputsByFighterId[f.id] = {
              ...member.heldInput,
              jumpPressed: member.pendingEdges.jumpPressed,
              dashPressed: member.pendingEdges.dashPressed,
              slidePressed: member.pendingEdges.slidePressed,
              grapplePressed: member.pendingEdges.grapplePressed,
              divePressed: member.pendingEdges.divePressed,
              attackPressed: member.pendingEdges.attackPressed,
            };
            member.pendingEdges.jumpPressed = false;
            member.pendingEdges.dashPressed = false;
            member.pendingEdges.slidePressed = false;
            member.pendingEdges.grapplePressed = false;
            member.pendingEdges.divePressed = false;
            member.pendingEdges.attackPressed = false;
          } else {
            inputsByFighterId[f.id] = computeAiInput(sim, f, dt);
          }
        } else {
          inputsByFighterId[f.id] = computeAiInput(sim, f, dt);
        }
      }

      stepSimulation(sim, dt, inputsByFighterId);
      for (const ev of sim.events) {
        room.pendingEvents.push(ev);
      }

      room.tickCount += 1;
      if (room.tickCount % 2 === 0 || sim.matchFinished) {
        const frame = captureReplayFrame(sim, room.pendingEvents);
        room.pendingEvents = [];
        for (const p of room.players) {
          this.sendFn(p.clientId, { type: 'sim_snapshot', frame });
        }
      }

      if (sim.matchFinished) {
        room.status = 'finished';
        const arenaName = createArenaConfig(sim.arenaId).name;
        for (const p of room.players) {
          const result = buildMatchResult(sim, arenaName, p.slot);
          this.sendFn(p.clientId, { type: 'match_over', result });
        }
        this.broadcastRoomState(room);
      }
    }
  }

  public leaveRoom(clientId: string, notifyClient = true): void {
    const code = this.clientRoomMap.get(clientId);
    if (!code) {
      if (notifyClient) this.sendFn(clientId, { type: 'room_left' });
      return;
    }
    this.clientRoomMap.delete(clientId);
    const room = this.rooms.get(code);
    if (!room) return;

    room.players = room.players.filter((p) => p.clientId !== clientId);
    if (notifyClient) {
      this.sendFn(clientId, { type: 'room_left' });
    }

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return;
    }

    if (!room.players.some((p) => p.isHost)) {
      room.players[0].isHost = true;
      room.players[0].ready = true;
    }

    this.broadcastRoomState(room);
  }
}

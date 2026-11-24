import { FIGHTER_ARCHETYPES } from './constants.ts';
import type {
  ActiveMechState,
  AttackState,
  FighterArchetypeId,
  FighterState,
  GameMode,
  GrappleState,
  KingZoneState,
  MechId,
  SimEvent,
  SimulationState,
} from './types.ts';

export interface ReplayFighterFrame {
  id: number;
  name: string;
  isHuman: boolean;
  playerSlot: number;
  archetypeId: FighterArchetypeId;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  slideTimer: number;
  dashTimer: number;
  diveActive: boolean;
  defending: boolean;
  defendTimer: number;
  guardBreakTimer: number;
  damagePercent: number;
  hitstunTimer: number;
  hitFlashTimer: number;
  ragdollAngle: number;
  strideDistance: number;
  squashX: number;
  squashY: number;
  intangibleToPlayers: boolean;
  stocks: number;
  maxStocks: number;
  teamId: 0 | 1 | null;
  kingScore: number;
  respawnTimer: number;
  spawnInvulnTimer: number;
  kos: number;
  deaths: number;
  posture: number;
  grapple: GrappleState;
  attackPhase: AttackState['phase'];
  attackTimer: number;
  activeMech: ActiveMechState | null;
}

export interface ReplayPlatformFrame {
  id: string;
  x: number;
  y: number;
  broken: boolean;
  crumbleTimer: number;
}

export interface ReplayHazardFrame {
  id: string;
  y: number;
  active: boolean;
  warningTimer: number;
  exploded: boolean;
}

export interface ReplayFrame {
  elapsed: number;
  trauma: number;
  gameMode: GameMode;
  teamScores: [number, number];
  kingZone: KingZoneState | null;
  platforms: ReplayPlatformFrame[];
  hazards: ReplayHazardFrame[];
  fighters: ReplayFighterFrame[];
  events: SimEvent[];
}

export function captureReplayFrame(sim: SimulationState, events: SimEvent[]): ReplayFrame {
  return {
    elapsed: sim.elapsed,
    trauma: sim.trauma,
    gameMode: sim.gameMode,
    teamScores: [sim.teamScores[0], sim.teamScores[1]],
    kingZone: sim.kingZone ? { ...sim.kingZone } : null,
    platforms: sim.platforms.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      broken: Boolean(p.broken),
      crumbleTimer: p.crumbleTimer ?? 0,
    })),
    hazards: sim.hazards.map((h) => ({
      id: h.id,
      y: h.y,
      active: h.active,
      warningTimer: h.warningTimer,
      exploded: Boolean(h.exploded),
    })),
    fighters: sim.fighters.map((f) => ({
      id: f.id,
      name: f.name,
      isHuman: f.isHuman,
      playerSlot: f.playerSlot,
      archetypeId: f.archetype.id,
      alive: f.alive,
      x: f.x,
      y: f.y,
      vx: f.vx,
      vy: f.vy,
      facing: f.facing,
      grounded: f.grounded,
      slideTimer: f.slideTimer,
      dashTimer: f.dashTimer,
      diveActive: f.diveActive,
      defending: f.defending,
      defendTimer: f.defendTimer,
      guardBreakTimer: f.guardBreakTimer,
      damagePercent: f.damagePercent,
      hitstunTimer: f.hitstunTimer,
      hitFlashTimer: f.hitFlashTimer,
      ragdollAngle: f.ragdollAngle,
      strideDistance: f.strideDistance,
      squashX: f.squashX,
      squashY: f.squashY,
      intangibleToPlayers: f.intangibleToPlayers,
      stocks: f.stocks,
      maxStocks: f.maxStocks,
      teamId: f.teamId,
      kingScore: f.kingScore,
      respawnTimer: f.respawnTimer,
      spawnInvulnTimer: f.spawnInvulnTimer,
      kos: f.kos,
      deaths: f.deaths,
      posture: f.posture,
      grapple: { ...f.grapple },
      attackPhase: f.attack.phase,
      attackTimer: f.attack.timer,
      activeMech: f.activeMech ? { ...f.activeMech } : null,
    })),
    events: events.map((e) => ({ ...e })),
  };
}

export function applyReplayFrameToSim(sim: SimulationState, frame: ReplayFrame): void {
  sim.elapsed = frame.elapsed;
  sim.trauma = frame.trauma;
  sim.gameMode = frame.gameMode;
  sim.teamScores = [frame.teamScores[0], frame.teamScores[1]];
  sim.kingZone = frame.kingZone ? { ...frame.kingZone } : null;
  sim.events = frame.events.map((e) => ({ ...e }));

  for (const pf of frame.platforms) {
    const plat = sim.platforms.find((p) => p.id === pf.id);
    if (plat) {
      plat.x = pf.x;
      plat.y = pf.y;
      plat.broken = pf.broken;
      plat.crumbleTimer = pf.crumbleTimer;
    }
  }

  for (const hf of frame.hazards) {
    const haz = sim.hazards.find((h) => h.id === hf.id);
    if (haz) {
      haz.y = hf.y;
      haz.active = hf.active;
      haz.warningTimer = hf.warningTimer;
      haz.exploded = hf.exploded;
    }
  }

  for (const ff of frame.fighters) {
    let fighter = sim.fighters.find((f) => f.id === ff.id);
    if (!fighter) {
      const arch =
        FIGHTER_ARCHETYPES.find((a) => a.id === ff.archetypeId) ?? FIGHTER_ARCHETYPES[0];
      fighter = {
        id: ff.id,
        name: ff.name,
        isHuman: ff.isHuman,
        playerSlot: ff.playerSlot,
        archetype: arch,
        alive: ff.alive,
        eliminatedAt: null,
        eliminatedBy: null,
        kos: ff.kos,
        deaths: ff.deaths,
        mechsTriggered: 0,
        stocks: ff.stocks,
        maxStocks: ff.maxStocks,
        respawnTimer: ff.respawnTimer,
        spawnInvulnTimer: ff.spawnInvulnTimer,
        teamId: ff.teamId,
        kingScore: ff.kingScore,
        x: ff.x,
        y: ff.y,
        vx: ff.vx,
        vy: ff.vy,
        width: 0.85,
        height: 1.55,
        facing: ff.facing,
        grounded: ff.grounded,
        groundPlatformId: null,
        coyoteTimer: 0,
        jumpBufferTimer: 0,
        doubleJumpAvailable: true,
        onWall: 0,
        wallCoyoteTimer: 0,
        lastWallSide: 0,
        dashTimer: ff.dashTimer,
        dashCooldown: 0,
        dashDirX: ff.facing,
        dashDirY: 0,
        slideTimer: ff.slideTimer,
        slideCooldown: 0,
        diveActive: ff.diveActive,
        diveSpeed: 0,
        ledgeGrab: {
          active: false,
          platformId: null,
          side: 1,
          ledgeX: 0,
          ledgeY: 0,
          timer: 0,
        },
        ledgeCooldown: 0,
        grapple: { ...ff.grapple },
        damagePercent: ff.damagePercent,
        hitstunTimer: ff.hitstunTimer,
        hitFlashTimer: ff.hitFlashTimer,
        ragdollSpin: 0,
        ragdollAngle: ff.ragdollAngle,
        attack: {
          phase: ff.attackPhase,
          timer: ff.attackTimer,
          dirX: ff.facing,
          dirY: 0,
          hitIds: [],
          momentumBonus: 0,
        },
        attackCooldown: 0,
        defending: ff.defending,
        defendTimer: ff.defendTimer,
        posture: ff.posture,
        guardBreakTimer: ff.guardBreakTimer,
        lastHitBy: null,
        lastHitTime: -99,
        actionHistory: [],
        activeMech: ff.activeMech ? { ...ff.activeMech } : null,
        mechCooldowns: {
          phantom: 0,
          meteor: 0,
          thunderbolt: 0,
          spider: 0,
          comet: 0,
          bulldozer: 0,
        } satisfies Record<MechId, number>,
        runStreakTime: 0,
        intangibleToPlayers: ff.intangibleToPlayers,
        strideDistance: ff.strideDistance,
        squashX: ff.squashX,
        squashY: ff.squashY,
        aiPolicy: 'brawler',
        aiTimer: 0,
        aiTargetId: null,
      };
      sim.fighters.push(fighter);
    } else {
      Object.assign(fighter, {
        name: ff.name,
        isHuman: ff.isHuman,
        playerSlot: ff.playerSlot,
        alive: ff.alive,
        x: ff.x,
        y: ff.y,
        vx: ff.vx,
        vy: ff.vy,
        facing: ff.facing,
        grounded: ff.grounded,
        slideTimer: ff.slideTimer,
        dashTimer: ff.dashTimer,
        diveActive: ff.diveActive,
        defending: ff.defending,
        defendTimer: ff.defendTimer,
        guardBreakTimer: ff.guardBreakTimer,
        damagePercent: ff.damagePercent,
        hitstunTimer: ff.hitstunTimer,
        hitFlashTimer: ff.hitFlashTimer,
        ragdollAngle: ff.ragdollAngle,
        strideDistance: ff.strideDistance,
        squashX: ff.squashX,
        squashY: ff.squashY,
        intangibleToPlayers: ff.intangibleToPlayers,
        stocks: ff.stocks,
        maxStocks: ff.maxStocks,
        teamId: ff.teamId,
        kingScore: ff.kingScore,
        respawnTimer: ff.respawnTimer,
        spawnInvulnTimer: ff.spawnInvulnTimer,
        kos: ff.kos,
        deaths: ff.deaths,
        posture: ff.posture,
      });
      fighter.grapple = { ...ff.grapple };
      fighter.attack.phase = ff.attackPhase;
      fighter.attack.timer = ff.attackTimer;
      fighter.activeMech = ff.activeMech ? { ...ff.activeMech } : null;
    }
  }
}

export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private koTimes: number[] = [];
  private readonly maxFrames: number;
  private tickMod = 0;
  private bufferedEvents: SimEvent[] = [];

  constructor(maxFrames = 1350) {
    // 1350 frames at 30fps = 45 seconds circular buffer
    this.maxFrames = maxFrames;
  }

  public reset(): void {
    this.frames = [];
    this.koTimes = [];
    this.tickMod = 0;
    this.bufferedEvents = [];
  }

  public recordStep(sim: SimulationState): void {
    for (const ev of sim.events) {
      this.bufferedEvents.push({ ...ev });
      if (ev.type === 'ko') {
        this.koTimes.push(sim.elapsed);
      }
    }

    this.tickMod = (this.tickMod + 1) % 2;
    if (this.tickMod !== 0 && !sim.matchFinished) return;

    this.frames.push(captureReplayFrame(sim, this.bufferedEvents));
    this.bufferedEvents = [];

    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
      const firstElapsed = this.frames[0]?.elapsed ?? 0;
      this.koTimes = this.koTimes.filter((t) => t >= firstElapsed);
    }
  }

  public pushExternalFrame(frame: ReplayFrame): void {
    for (const ev of frame.events) {
      if (ev.type === 'ko') {
        this.koTimes.push(frame.elapsed);
      }
    }
    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
      const firstElapsed = this.frames[0]?.elapsed ?? 0;
      this.koTimes = this.koTimes.filter((t) => t >= firstElapsed);
    }
  }

  public getFrames(): ReplayFrame[] {
    return this.frames;
  }

  public getKoTimes(): number[] {
    return this.koTimes;
  }

  public hasFrames(): boolean {
    return this.frames.length > 0;
  }

  /**
   * Returns frame index ~2.8 seconds before the requested KO (defaults to final KO).
   */
  public findBestKoReplayStart(koIndex?: number): number {
    if (this.frames.length === 0) return 0;
    if (this.koTimes.length === 0) {
      return Math.max(0, this.frames.length - 120);
    }
    const idx =
      koIndex !== undefined
        ? Math.max(0, Math.min(this.koTimes.length - 1, koIndex))
        : this.koTimes.length - 1;
    const targetTime = Math.max(0, this.koTimes[idx] - 2.8);
    const frameIdx = this.frames.findIndex((f) => f.elapsed >= targetTime);
    return frameIdx >= 0 ? frameIdx : 0;
  }
}

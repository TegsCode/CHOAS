import { createArenaConfig, FIGHTER_ARCHETYPES, GAME_MODES, MECH_DEFINITIONS, PHYSICS } from './constants.ts';
import { recordMovementVerb, tickFighterMechs } from './mechs.ts';
import type {
  ArenaConfig,
  ArenaId,
  FighterArchetype,
  FighterState,
  GameMode,
  KingZoneSpot,
  MatchResultSummary,
  MechId,
  PlatformRect,
  PlayerInput,
  SimulationState,
  TutorialBotBehavior,
  TutorialMode,
} from './types.ts';

export interface OnlineHumanSpec {
  slot: number;
  name: string;
  archetypeId: string;
  teamId?: 0 | 1 | null;
}

export interface CreateMatchOptions {
  arenaId: ArenaId;
  gameMode?: GameMode;
  fighterCount: number; // 2..8
  p1ArchetypeId: string;
  p2Enabled?: boolean;
  p2ArchetypeId?: string;
  demoMode?: boolean;
  tutorial?: boolean;
  tutorialMode?: TutorialMode;
  tutorialPaceScale?: number;
  tutorialBotBehavior?: TutorialBotBehavior;
  tutorialBotAggression?: number;
  tutorialBotHomeX?: number;
  playerStartDamage?: number;
  customArena?: ArenaConfig;
  customHumans?: OnlineHumanSpec[];
  customBots?: Array<{
    x: number;
    y: number;
    archetypeId?: string;
    policy?: FighterState['aiPolicy'];
    name?: string;
    initialDamage?: number;
  }>;
}

export const EMPTY_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  jumpHeld: false,
  jumpPressed: false,
  dashPressed: false,
  slideHeld: false,
  slidePressed: false,
  grappleHeld: false,
  grapplePressed: false,
  pullHeld: false,
  divePressed: false,
  attackPressed: false,
  defendHeld: false,
};

function createEmptyCooldowns(): Record<MechId, number> {
  return {
    phantom: 0,
    meteor: 0,
    thunderbolt: 0,
    spider: 0,
    comet: 0,
    bulldozer: 0,
  };
}

export function createFighter(
  id: number,
  name: string,
  archetype: FighterArchetype,
  spawnX: number,
  spawnY: number,
  isHuman: boolean,
  playerSlot: number,
  aiPolicy: FighterState['aiPolicy']
): FighterState {
  return {
    id,
    name,
    isHuman,
    playerSlot,
    archetype,
    alive: true,
    eliminatedAt: null,
    eliminatedBy: null,
    kos: 0,
    deaths: 0,
    mechsTriggered: 0,

    stocks: 1,
    maxStocks: 1,
    respawnTimer: 0,
    spawnInvulnTimer: 0,
    teamId: null,
    kingScore: 0,

    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    width: PHYSICS.FIGHTER_WIDTH,
    height: PHYSICS.FIGHTER_HEIGHT,
    facing: spawnX > 0 ? -1 : 1,

    grounded: false,
    groundPlatformId: null,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    doubleJumpAvailable: true,
    onWall: 0,
    wallCoyoteTimer: 0,
    lastWallSide: 0,

    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 1,
    dashDirY: 0,
    slideTimer: 0,
    slideCooldown: 0,
    diveActive: false,
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

    grapple: {
      active: false,
      phase: 'none',
      targetType: 'surface',
      targetPlayerId: null,
      anchorX: 0,
      anchorY: 0,
      hookX: spawnX,
      hookY: spawnY,
      length: 0,
      maxLength: PHYSICS.GRAPPLE_RANGE,
      swingSpeed: 0,
      attachedTime: 0,
    },

    damagePercent: 0,
    hitstunTimer: 0,
    hitFlashTimer: 0,
    ragdollSpin: 0,
    ragdollAngle: 0,
    attack: {
      phase: 'none',
      timer: 0,
      dirX: 1,
      dirY: 0,
      hitIds: [],
      momentumBonus: 0,
    },
    attackCooldown: 0,
    defending: false,
    defendTimer: 0,
    posture: 100,
    guardBreakTimer: 0,
    lastHitBy: null,
    lastHitTime: -99,

    actionHistory: [],
    activeMech: null,
    mechCooldowns: createEmptyCooldowns(),
    runStreakTime: 0,
    intangibleToPlayers: false,

    strideDistance: 0,
    squashX: 1,
    squashY: 1,
    aiPolicy,
    aiTimer: (id * 0.17) % 0.6,
    aiTargetId: null,
  };
}

export function createSimulation(opts: CreateMatchOptions): SimulationState {
  const isTutorial = Boolean(opts.tutorial);
  const tutorialMode: TutorialMode | undefined = isTutorial
    ? opts.tutorialMode ?? 'basics'
    : undefined;
  const gameMode: GameMode = isTutorial ? 'last_standing' : opts.gameMode ?? 'last_standing';
  const modeDef = GAME_MODES.find((m) => m.id === gameMode) ?? GAME_MODES[0];

  const arena =
    opts.customArena ??
    createArenaConfig(
      isTutorial ? (tutorialMode === 'crucible' ? 'crucible' : 'tutorial') : opts.arenaId
    );
  const count = isTutorial ? 2 : Math.min(8, Math.max(2, opts.fighterCount));

  const p1Arch =
    FIGHTER_ARCHETYPES.find((a) => a.id === opts.p1ArchetypeId) ?? FIGHTER_ARCHETYPES[0];
  const p2Arch =
    FIGHTER_ARCHETYPES.find((a) => a.id === opts.p2ArchetypeId) ?? FIGHTER_ARCHETYPES[1];

  const remainingArchs = FIGHTER_ARCHETYPES.filter(
    (a) => a.id !== p1Arch.id && (!opts.p2Enabled || a.id !== p2Arch.id)
  );
  const policies: FighterState['aiPolicy'][] = ['brawler', 'acrobat', 'hunter', 'opportunist'];

  const fighters: FighterState[] = [];

  if (isTutorial) {
    const sp0 = arena.spawnPoints[0] ?? { x: -11.5, y: 1.2 };
    const p1 = createFighter(0, `P1 · ${p1Arch.name}`, p1Arch, sp0.x, sp0.y, true, 0, 'brawler');
    if (opts.playerStartDamage && opts.playerStartDamage > 0) {
      p1.damagePercent = opts.playerStartDamage;
    }
    fighters.push(p1);

    if (opts.customBots !== undefined) {
      opts.customBots.forEach((botSpec, idx) => {
        const botArch =
          FIGHTER_ARCHETYPES.find((a) => a.id === botSpec.archetypeId) ??
          remainingArchs[idx % remainingArchs.length];
        const bot = createFighter(
          idx + 1,
          botSpec.name ?? botArch.name,
          botArch,
          botSpec.x,
          botSpec.y,
          false,
          -1,
          botSpec.policy ?? policies[idx % policies.length]
        );
        if (botSpec.initialDamage && botSpec.initialDamage > 0) {
          bot.damagePercent = botSpec.initialDamage;
        }
        fighters.push(bot);
      });
    } else {
      const sp1 = arena.spawnPoints[1] ?? { x: 8.5, y: 2.8 };
      const dummyArch =
        FIGHTER_ARCHETYPES.find((a) => a.id === 'titan') ??
        remainingArchs[0] ??
        FIGHTER_ARCHETYPES[1];
      fighters.push(
        createFighter(1, 'Sparring Dummy', dummyArch, sp1.x, sp1.y, false, -1, 'brawler')
      );
    }
  } else if (opts.customHumans && opts.customHumans.length > 0) {
    for (let i = 0; i < count; i++) {
      const sp = arena.spawnPoints[i % arena.spawnPoints.length];
      const humanSpec = opts.customHumans[i];
      if (humanSpec) {
        const arch =
          FIGHTER_ARCHETYPES.find((a) => a.id === humanSpec.archetypeId) ?? FIGHTER_ARCHETYPES[i % FIGHTER_ARCHETYPES.length];
        const fighter = createFighter(
          i,
          humanSpec.name,
          arch,
          sp.x,
          sp.y,
          true,
          humanSpec.slot,
          policies[i % policies.length]
        );
        fighter.stocks = modeDef.stocks;
        fighter.maxStocks = modeDef.stocks;
        fighter.teamId =
          gameMode === 'team_chaos'
            ? humanSpec.teamId ?? ((i % 2) as 0 | 1)
            : null;
        fighters.push(fighter);
      } else {
        const arch = FIGHTER_ARCHETYPES[(i + 2) % FIGHTER_ARCHETYPES.length];
        const fighter = createFighter(
          i,
          `${arch.name} (CPU)`,
          arch,
          sp.x,
          sp.y,
          false,
          -1,
          policies[i % policies.length]
        );
        fighter.stocks = modeDef.stocks;
        fighter.maxStocks = modeDef.stocks;
        fighter.teamId = gameMode === 'team_chaos' ? ((i % 2) as 0 | 1) : null;
        fighters.push(fighter);
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const sp = arena.spawnPoints[i % arena.spawnPoints.length];
      let fighter: FighterState;
      if (i === 0 && !opts.demoMode) {
        fighter = createFighter(0, `P1 · ${p1Arch.name}`, p1Arch, sp.x, sp.y, true, 0, 'brawler');
      } else if (i === 1 && opts.p2Enabled && !opts.demoMode) {
        fighter = createFighter(1, `P2 · ${p2Arch.name}`, p2Arch, sp.x, sp.y, true, 1, 'acrobat');
      } else {
        const archIdx =
          (i - (opts.demoMode ? 0 : opts.p2Enabled ? 2 : 1) + remainingArchs.length) %
          remainingArchs.length;
        const arch = i === 0 && opts.demoMode ? p1Arch : remainingArchs[Math.max(0, archIdx)];
        fighter = createFighter(
          i,
          `${arch.name}`,
          arch,
          sp.x,
          sp.y,
          false,
          -1,
          policies[i % policies.length]
        );
      }
      fighter.stocks = modeDef.stocks;
      fighter.maxStocks = modeDef.stocks;
      fighter.teamId = gameMode === 'team_chaos' ? ((i % 2) as 0 | 1) : null;
      fighters.push(fighter);
    }
  }

  const kingSpots: KingZoneSpot[] =
    arena.kingZones && arena.kingZones.length > 0
      ? arena.kingZones.map((z) => ({ ...z }))
      : [{ x: 0, y: 2.0, w: 3.6, h: 2.1 }];

  const kingZone =
    gameMode === 'king_of_platform' && !isTutorial
      ? {
          ...kingSpots[0],
          controllerId: null,
          contested: false,
          shiftTimer: 24,
          spotIndex: 0,
        }
      : null;

  return {
    arenaId: arena.id,
    gameMode,
    timeLimitSeconds: isTutorial ? null : modeDef.timeLimitSeconds,
    elapsed: 0,
    hitstopTimer: 0,
    trauma: 0,
    blastBounds: { ...arena.blastBounds },
    platforms: arena.platforms.map((p) => ({ ...p })),
    anchors: arena.anchors.map((a) => ({ ...a })),
    hazards: arena.hazards.map((h) => ({ ...h })),
    kingZone,
    kingSpots,
    teamScores: [0, 0],
    fighters,
    events: [],
    winnerId: null,
    winningTeam: null,
    matchFinished: false,
    finishDelayTimer: 0,
    escalationLevel: 0,
    isTutorial,
    tutorialMode,
    dummyRespawnTimer: 0,
    tutorialPaceScale: opts.tutorialPaceScale ?? 1.0,
    tutorialBotBehavior: opts.tutorialBotBehavior,
    tutorialBotAggression: opts.tutorialBotAggression ?? 0.75,
    tutorialBotHomeX: opts.tutorialBotHomeX,
    tutorialSafeSpawn: isTutorial ? { ...(arena.spawnPoints[0] ?? { x: -8.0, y: 2.0 }) } : undefined,
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function getPlatformBounds(p: PlatformRect) {
  return {
    left: p.x - p.w * 0.5,
    right: p.x + p.w * 0.5,
    top: p.y + p.h * 0.5,
    bottom: p.y - p.h * 0.5,
  };
}

function triggerMechEvent(state: SimulationState, fighter: FighterState, mechId: MechId | null) {
  if (!mechId) return;
  const def = MECH_DEFINITIONS[mechId];
  state.events.push({
    type: 'mech_trigger',
    x: fighter.x,
    y: fighter.y + 0.8,
    fighterId: fighter.id,
    mechId,
    color: def.color,
  });
}

function raycastBox(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  left: number,
  right: number,
  bottom: number,
  top: number
): { t: number; x: number; y: number } | null {
  const invX = Math.abs(dx) > 1e-6 ? 1 / dx : 1e9;
  const invY = Math.abs(dy) > 1e-6 ? 1 / dy : 1e9;

  const t1 = (left - ox) * invX;
  const t2 = (right - ox) * invX;
  const t3 = (bottom - oy) * invY;
  const t4 = (top - oy) * invY;

  const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
  const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

  if (tmax < 0 || tmin > tmax) return null;
  const tHit = tmin >= 0 ? tmin : tmax;
  if (tHit < 0.45 || tHit > maxDist) return null;
  return {
    t: tHit,
    x: ox + dx * tHit,
    y: oy + dy * tHit,
  };
}

function findGrappleTarget(
  state: SimulationState,
  fighter: FighterState,
  input: PlayerInput
): {
  type: 'surface' | 'player';
  targetPlayerId: number | null;
  x: number;
  y: number;
} | null {
  const originX = fighter.x;
  const originY = fighter.y + fighter.height * 0.62;

  let aimX = input.aimX ?? (input.moveX !== 0 ? input.moveX * 0.72 : fighter.facing * 0.68);
  let aimY = input.aimY ?? (input.moveY !== 0 ? input.moveY : 0.74);
  const aimLen = Math.hypot(aimX, aimY) || 1;
  aimX /= aimLen;
  aimY /= aimLen;

  let bestScore = -Infinity;
  let bestTarget: {
    type: 'surface' | 'player';
    targetPlayerId: number | null;
    x: number;
    y: number;
  } | null = null;

  // 1. Direct Raycast onto ANY grappleable platform surface, wall, underside, or crate!
  for (const plat of state.platforms) {
    if (plat.broken || !plat.grappleable) continue;
    // Do not hook your own feet on the floor you're currently standing on when aiming up/forward
    if (fighter.grounded && fighter.groundPlatformId === plat.id && aimY > -0.15) continue;

    const b = getPlatformBounds(plat);
    const hit = raycastBox(
      originX,
      originY,
      aimX,
      aimY,
      PHYSICS.GRAPPLE_RANGE,
      b.left,
      b.right,
      b.bottom,
      b.top
    );
    if (hit) {
      // Exact line-of-sight surface hit gets high priority!
      const score = 3.2 - hit.t * 0.14;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { type: 'surface', targetPlayerId: null, x: hit.x, y: hit.y };
      }
      continue;
    }

    // Magnetic fallback cone onto nearest perimeter edge/underside of nearby platforms (for keyboard aiming)
    const cx = clamp(originX + aimX * 5.5, b.left, b.right);
    const cy = clamp(originY + aimY * 5.5, b.bottom, b.top);
    const dx = cx - originX;
    const dy = cy - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > PHYSICS.GRAPPLE_RANGE || dist < 0.55) continue;
    const dot = (dx / dist) * aimX + (dy / dist) * aimY;
    if (dot < 0.25) continue;
    const score = dot * 2.0 - dist * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = { type: 'surface', targetPlayerId: null, x: cx, y: cy };
    }
  }

  // 2. Check other alive fighters (hook directly onto rival bodies — skip allies in Team Chaos)
  for (const other of state.fighters) {
    if (!other.alive || other.id === fighter.id) continue;
    if (areTeammates(state, fighter, other)) continue;
    const ox = other.x;
    const oy = other.y + other.height * 0.55;
    const dx = ox - originX;
    const dy = oy - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > PHYSICS.GRAPPLE_RANGE * 0.92 || dist < 1.0) continue;
    const dot = (dx / dist) * aimX + (dy / dist) * aimY;
    if (dot < 0.35) continue;
    const score = dot * 2.6 - dist * 0.11 + 0.25;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = { type: 'player', targetPlayerId: other.id, x: ox, y: oy };
    }
  }

  // 3. Bonus sky ceiling hooks where no platform geometry sits overhead
  for (const anchor of state.anchors) {
    const dx = anchor.x - originX;
    const dy = anchor.y - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > PHYSICS.GRAPPLE_RANGE || dist < 1.0) continue;
    const dot = (dx / dist) * aimX + (dy / dist) * aimY;
    if (dot < 0.18) continue;
    const score = dot * 2.15 - dist * 0.09 + 0.2;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = { type: 'surface', targetPlayerId: null, x: anchor.x, y: anchor.y };
    }
  }

  return bestTarget;
}

export function areTeammates(
  state: SimulationState,
  a: FighterState | null | undefined,
  b: FighterState | null | undefined
): boolean {
  if (!a || !b || a.id === b.id) return false;
  return (
    state.gameMode === 'team_chaos' &&
    a.teamId !== null &&
    b.teamId !== null &&
    a.teamId === b.teamId
  );
}

function applyKnockback(
  state: SimulationState,
  target: FighterState,
  attacker: FighterState | null,
  dirX: number,
  dirY: number,
  baseForce: number,
  damageAdd: number
): void {
  if (target.spawnInvulnTimer > 0) return;
  if (attacker && areTeammates(state, target, attacker)) return;

  const len = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / len;
  const ny = dirY / len;

  // Defend check
  if (target.defending && target.guardBreakTimer <= 0) {
    if (target.defendTimer <= PHYSICS.PARRY_WINDOW) {
      // Perfect Parry!
      state.hitstopTimer = Math.max(state.hitstopTimer, 0.055);
      state.trauma = Math.min(1, state.trauma + 0.35);
      target.posture = 100;
      if (attacker) {
        attacker.vx = -nx * 14;
        attacker.vy = 6.5;
        attacker.hitstunTimer = 0.42;
        attacker.hitFlashTimer = 0.14;
        attacker.ragdollSpin = -nx * 11;
      }
      state.events.push({
        type: 'parry',
        x: target.x,
        y: target.y + 0.8,
        fighterId: target.id,
        targetId: attacker?.id,
      });
      return;
    }

    // Standard Guard Block
    target.posture = Math.max(0, target.posture - damageAdd * 1.6);
    target.vx += nx * baseForce * PHYSICS.GUARD_KNOCKBACK_MULT;
    target.vy += ny * baseForce * PHYSICS.GUARD_KNOCKBACK_MULT * 0.5;
    target.damagePercent += damageAdd * 0.35;
    state.events.push({
      type: 'guard_block',
      x: target.x,
      y: target.y + 0.8,
      fighterId: target.id,
    });
    if (target.posture <= 0) {
      target.guardBreakTimer = 1.25;
      target.defending = false;
      target.hitstunTimer = 0.85;
      target.vy = 9;
      target.ragdollSpin = nx * 12;
    }
    return;
  }

  // Unblocked hit!
  target.damagePercent = Math.min(350, target.damagePercent + damageAdd);
  const scale = 1 + target.damagePercent / 95;
  const launchSpeed = baseForce * scale;

  target.vx = nx * launchSpeed;
  target.vy = Math.max(ny * launchSpeed, 4.5 + launchSpeed * 0.32);
  target.grounded = false;
  target.ledgeGrab.active = false;
  target.grapple.active = false;
  target.diveActive = false;
  target.hitstunTimer = clamp(0.22 + launchSpeed * 0.022, 0.22, 0.95);
  target.hitFlashTimer = 0.12;
  target.ragdollSpin = (nx >= 0 ? -1 : 1) * clamp(launchSpeed * 0.85, 6, 20);

  if (attacker) {
    target.lastHitBy = attacker.id;
    target.lastHitTime = state.elapsed;
  }

  state.hitstopTimer = Math.max(state.hitstopTimer, clamp(0.025 + launchSpeed * 0.0014, 0.03, 0.07));
  state.trauma = Math.min(1, state.trauma + clamp(launchSpeed / 52, 0.14, 0.65));

  state.events.push({
    type: 'attack_hit',
    x: target.x,
    y: target.y + 0.8,
    vx: target.vx,
    vy: target.vy,
    fighterId: attacker?.id,
    targetId: target.id,
    power: launchSpeed,
  });
}

function triggerRadialShockwave(
  state: SimulationState,
  source: FighterState,
  radius: number,
  baseForce: number,
  damageAdd: number,
  color: string,
  mechId?: MechId
): void {
  state.events.push({
    type: 'mech_pulse',
    x: source.x,
    y: source.y + 0.3,
    fighterId: source.id,
    mechId,
    power: radius,
    color,
  });

  for (const other of state.fighters) {
    if (!other.alive || other.id === source.id) continue;
    const dx = other.x - source.x;
    const dy = other.y + 0.5 - (source.y + 0.4);
    const dist = Math.hypot(dx, dy);
    if (dist <= radius) {
      const falloff = 1 - (dist / radius) * 0.45;
      const nx = dist > 0.05 ? dx / dist : source.facing;
      const ny = 0.55;
      applyKnockback(state, other, source, nx, ny, baseForce * falloff, damageAdd * falloff);
    }
  }

  // Also damage nearby destructible crates / explode barrels
  for (const plat of state.platforms) {
    if (plat.broken || plat.kind !== 'destructible') continue;
    if (Math.hypot(plat.x - source.x, plat.y - source.y) <= radius + 0.8) {
      damageCrate(state, plat, 35);
    }
  }
  for (const haz of state.hazards) {
    if (haz.kind === 'barrel' && !haz.exploded) {
      if (Math.hypot(haz.x - source.x, haz.y - source.y) <= radius + 0.8) {
        detonateBarrel(state, haz, source.id);
      }
    }
  }
}

function damageCrate(state: SimulationState, plat: PlatformRect, amount: number): void {
  if (plat.broken || plat.kind !== 'destructible') return;
  plat.hp = (plat.hp ?? 30) - amount;
  if (plat.hp <= 0) {
    plat.broken = true;
    plat.respawnTimer = 10.0;
    state.events.push({
      type: 'crate_break',
      x: plat.x,
      y: plat.y,
      color: plat.color,
    });
  }
}

function detonateBarrel(state: SimulationState, haz: SimulationState['hazards'][number], triggerId: number | null): void {
  if (haz.exploded) return;
  haz.exploded = true;
  haz.respawnTimer = 9.0;
  state.trauma = Math.min(1, state.trauma + 0.65);
  state.hitstopTimer = Math.max(state.hitstopTimer, 0.055);
  state.events.push({
    type: 'barrel_explode',
    x: haz.x,
    y: haz.y,
    power: 4.5,
  });

  const attacker = triggerId !== null ? state.fighters.find((f) => f.id === triggerId) ?? null : null;
  for (const f of state.fighters) {
    if (!f.alive) continue;
    const dx = f.x - haz.x;
    const dy = f.y + 0.6 - haz.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 4.4) {
      const falloff = 1 - (dist / 4.4) * 0.4;
      applyKnockback(
        state,
        f,
        attacker,
        dist > 0.05 ? dx / dist : 1,
        0.65,
        haz.knockback * falloff,
        24 * falloff
      );
    }
  }
}

function pickSafeRespawnPoint(state: SimulationState, fighter: FighterState): { x: number; y: number } {
  const solidPlats = state.platforms.filter(
    (p) => !p.broken && (p.kind === 'solid' || p.kind === 'moving') && p.w >= 3.2
  );
  if (solidPlats.length > 0) {
    const plat = solidPlats[fighter.id % solidPlats.length];
    return { x: plat.x, y: plat.y + plat.h * 0.5 + 2.2 };
  }
  return { x: 0, y: 4.5 };
}

function eliminateFighter(state: SimulationState, fighter: FighterState, killerId: number | null): void {
  if (!fighter.alive) return;

  if (state.isTutorial && fighter.isHuman) {
    // Emit tutorial_fall event for Academy failure tracking / prerequisite rerouting, then respawn cleanly
    state.events.push({
      type: 'tutorial_fall',
      x: clamp(fighter.x, state.blastBounds.left + 1, state.blastBounds.right - 1),
      y: clamp(fighter.y, state.blastBounds.bottom + 1, state.blastBounds.top - 1),
      fighterId: fighter.id,
      targetId: killerId ?? undefined,
    });
    const mainPlat = state.platforms.find((p) => !p.broken && p.kind === 'solid' && p.w >= 4) ?? state.platforms[0];
    const safeSp = state.tutorialSafeSpawn;
    fighter.x = safeSp
      ? safeSp.x
      : state.tutorialMode === 'crucible' && mainPlat
        ? mainPlat.x
        : fighter.x > 0
          ? 6.5
          : -10.5;
    fighter.y = safeSp
      ? safeSp.y
      : mainPlat
        ? mainPlat.y + mainPlat.h * 0.5 + 1.5
        : 3.2;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.damagePercent = 0;
    fighter.hitstunTimer = 0;
    fighter.ragdollAngle = 0;
    fighter.ragdollSpin = 0;
    fighter.grapple.active = false;
    fighter.grapple.phase = 'none';
    fighter.ledgeGrab.active = false;
    fighter.diveActive = false;
    fighter.doubleJumpAvailable = true;
    state.events.push({ type: 'land', x: fighter.x, y: fighter.y, fighterId: fighter.id });
    return;
  }

  fighter.alive = false;
  fighter.deaths += 1;
  fighter.eliminatedAt = state.elapsed;
  let creditedKillerId =
    killerId ?? (state.elapsed - fighter.lastHitTime < 6.5 ? fighter.lastHitBy : null);
  if (state.isTutorial && !fighter.isHuman && creditedKillerId === null) {
    creditedKillerId = 0;
  }
  fighter.eliminatedBy = creditedKillerId;

  if (creditedKillerId !== null && creditedKillerId !== fighter.id) {
    const killer = state.fighters.find((f) => f.id === creditedKillerId);
    if (killer && !areTeammates(state, killer, fighter)) {
      killer.kos += 1;
    }
  }

  if (state.gameMode === 'stock_brawl' || state.gameMode === 'team_chaos') {
    fighter.stocks = Math.max(0, fighter.stocks - 1);
    if (fighter.stocks > 0) {
      fighter.respawnTimer = 1.65;
    }
  } else if (state.gameMode === 'king_of_platform') {
    fighter.respawnTimer = 2.0;
  } else {
    fighter.stocks = 0;
  }

  if (state.isTutorial && !fighter.isHuman) {
    state.dummyRespawnTimer = 1.2;
  }

  fighter.grapple.active = false;
  fighter.grapple.phase = 'none';
  fighter.ledgeGrab.active = false;
  fighter.diveActive = false;
  state.trauma = Math.min(1, state.trauma + 0.55);
  state.events.push({
    type: 'ko',
    x: clamp(fighter.x, state.blastBounds.left + 1, state.blastBounds.right - 1),
    y: clamp(fighter.y, state.blastBounds.bottom + 1, state.blastBounds.top - 1),
    fighterId: fighter.id,
    targetId: creditedKillerId ?? undefined,
    color: fighter.archetype.primaryColor,
  });
}

export function stepSimulation(
  state: SimulationState,
  rawDt: number,
  inputsByFighterId: Record<number, PlayerInput>
): void {
  const dt = Math.min(rawDt, 0.05);
  state.events.length = 0;

  // Decay screen shake trauma in real-time even during hitstop
  state.trauma = Math.max(0, state.trauma - dt * 1.9);

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  state.elapsed += dt;
  state.escalationLevel = Math.floor(state.elapsed / 35);

  // 1. Update platforms (moving, crumbling, respawning)
  for (const plat of state.platforms) {
    if (plat.kind === 'moving' && plat.baseX !== undefined && plat.baseY !== undefined) {
      const freq = plat.moveFreq ?? 0.7;
      const phase = plat.movePhase ?? 0;
      const t = state.elapsed * freq + phase;
      const prevX = plat.x;
      const prevY = plat.y;
      plat.x = plat.baseX + Math.sin(t) * (plat.moveAmpX ?? 0);
      plat.y = plat.baseY + Math.sin(t) * (plat.moveAmpY ?? 0);
      const dx = plat.x - prevX;
      const dy = plat.y - prevY;
      // Carry grounded riders
      for (const f of state.fighters) {
        if (f.alive && f.grounded && f.groundPlatformId === plat.id) {
          f.x += dx;
          f.y += dy;
        }
      }
    }

    if (plat.kind === 'crumbling') {
      if (plat.broken) {
        plat.respawnTimer = (plat.respawnTimer ?? 0) - dt;
        if (plat.respawnTimer <= 0) {
          plat.broken = false;
          plat.crumbleTimer = 0;
        }
      } else if ((plat.crumbleTimer ?? 0) > 0) {
        plat.crumbleTimer = (plat.crumbleTimer ?? 0) - dt;
        if (plat.crumbleTimer <= 0) {
          plat.broken = true;
          plat.respawnTimer = 5.5;
          state.events.push({ type: 'crate_break', x: plat.x, y: plat.y, color: plat.color });
        }
      }
    }

    if (plat.kind === 'destructible' && plat.broken) {
      plat.respawnTimer = (plat.respawnTimer ?? 0) - dt;
      if (plat.respawnTimer <= 0) {
        plat.broken = false;
        plat.hp = plat.maxHp ?? 30;
      }
    }
  }

  // 2. Update hazards (Factory crusher, Furnace surging lava & barrels)
  for (const haz of state.hazards) {
    if (haz.kind === 'crusher') {
      const speedMult = 1 + state.escalationLevel * 0.25;
      haz.cycleTimer -= dt * speedMult;
      if (haz.cycleTimer <= 1.1 && haz.cycleTimer > 0) {
        haz.warningTimer = haz.cycleTimer;
        haz.active = false;
        haz.y = haz.baseY;
      } else if (haz.cycleTimer <= 0) {
        haz.warningTimer = 0;
        haz.active = true;
        // Slam down to y = 1.3
        haz.y = Math.max(1.3, haz.y - 34 * dt);
        if (haz.cycleTimer <= -0.55) {
          haz.active = false;
          haz.y = haz.baseY;
          haz.cycleTimer = 3.6;
        }
      } else {
        haz.warningTimer = 0;
        haz.active = false;
        haz.y = haz.baseY;
      }
    } else if (haz.kind === 'lava') {
      // Lava surges rhythmically and rises slightly with escalation
      const rise = Math.min(2.6, state.escalationLevel * 0.75);
      haz.y = haz.baseY + rise + Math.sin(state.elapsed * 0.9) * 1.1;
    } else if (haz.kind === 'barrel' && haz.exploded) {
      haz.respawnTimer = (haz.respawnTimer ?? 0) - dt;
      if (haz.respawnTimer <= 0) {
        haz.exploded = false;
      }
    }
  }

  // 3. Step each fighter (and respawn waiting fighters in stock/team/king modes)
  for (const f of state.fighters) {
    if (!f.alive) {
      if (!state.isTutorial && f.respawnTimer > 0) {
        f.respawnTimer = Math.max(0, f.respawnTimer - dt);
        if (f.respawnTimer <= 0 && (f.stocks > 0 || state.gameMode === 'king_of_platform')) {
          const sp = pickSafeRespawnPoint(state, f);
          f.alive = true;
          f.x = sp.x;
          f.y = sp.y;
          f.vx = 0;
          f.vy = 0;
          f.damagePercent = 0;
          f.hitstunTimer = 0;
          f.hitFlashTimer = 0;
          f.ragdollAngle = 0;
          f.ragdollSpin = 0;
          f.posture = 100;
          f.guardBreakTimer = 0;
          f.doubleJumpAvailable = true;
          f.spawnInvulnTimer = 1.4;
          f.lastHitBy = null;
          state.events.push({
            type: 'respawn',
            x: f.x,
            y: f.y + 0.7,
            fighterId: f.id,
            color: f.archetype.accentColor,
          });
        }
      }
      continue;
    }
    const input = inputsByFighterId[f.id] ?? EMPTY_INPUT;

    // Tick timers & Mechs
    tickFighterMechs(f, dt);
    f.spawnInvulnTimer = Math.max(0, f.spawnInvulnTimer - dt);
    f.hitFlashTimer = Math.max(0, f.hitFlashTimer - dt);
    f.dashCooldown = Math.max(0, f.dashCooldown - dt);
    f.slideCooldown = Math.max(0, f.slideCooldown - dt);
    f.attackCooldown = Math.max(0, f.attackCooldown - dt);
    f.ledgeCooldown = Math.max(0, f.ledgeCooldown - dt);
    f.guardBreakTimer = Math.max(0, f.guardBreakTimer - dt);

    // Relax squash & stretch smoothly back to 1
    const relax = 1 - Math.exp(-14 * dt);
    f.squashX += (1 - f.squashX) * relax;
    f.squashY += (1 - f.squashY) * relax;

    // Buffer jump input
    if (input.jumpPressed) {
      f.jumpBufferTimer = PHYSICS.JUMP_BUFFER_TIME;
    } else {
      f.jumpBufferTimer = Math.max(0, f.jumpBufferTimer - dt);
    }

    // Hitstun / Ragdoll state
    if (f.hitstunTimer > 0) {
      f.hitstunTimer = Math.max(0, f.hitstunTimer - dt);
      f.ragdollAngle += f.ragdollSpin * dt;
      f.defending = false;
      f.attack.phase = 'none';
      // Still obey gravity & air drag during ragdoll flight
      f.vy = Math.max(PHYSICS.MAX_FALL_SPEED, f.vy + PHYSICS.GRAVITY * dt);
      f.vx *= Math.max(0, 1 - 0.65 * dt);
      integrateAndCollide(state, f, dt, input);
      checkHazardsAndBlastBounds(state, f);
      continue;
    } else {
      // Smoothly return upright when out of hitstun
      f.ragdollAngle *= Math.exp(-16 * dt);
      f.ragdollSpin = 0;
    }

    // Ledge Grab state
    if (f.ledgeGrab.active) {
      f.ledgeGrab.timer += dt;
      f.vx = 0;
      f.vy = 0;
      f.x = f.ledgeGrab.ledgeX - f.ledgeGrab.side * (f.width * 0.55);
      f.y = f.ledgeGrab.ledgeY - f.height * 0.72;
      f.facing = f.ledgeGrab.side;
      f.doubleJumpAvailable = true;

      if (f.jumpBufferTimer > 0 || input.moveY > 0) {
        // Climb/Vault up from ledge
        f.ledgeGrab.active = false;
        f.ledgeCooldown = PHYSICS.LEDGE_COOLDOWN;
        f.jumpBufferTimer = 0;
        f.vy = PHYSICS.JUMP_VELOCITY * 0.85;
        f.vx = f.ledgeGrab.side * 6.5;
        f.squashX = 0.84;
        f.squashY = 1.2;
        state.events.push({ type: 'jump', x: f.x, y: f.y, fighterId: f.id });
      } else if (input.moveY < 0 || f.ledgeGrab.timer > 1.8) {
        // Drop off ledge
        f.ledgeGrab.active = false;
        f.ledgeCooldown = PHYSICS.LEDGE_COOLDOWN;
        f.vy = -3.5;
      }
      checkHazardsAndBlastBounds(state, f);
      continue;
    }

    // Facing update (unless sliding, attacking, or grappling)
    if (
      input.moveX !== 0 &&
      f.slideTimer <= 0 &&
      f.attack.phase === 'none' &&
      !f.defending
    ) {
      f.facing = input.moveX > 0 ? 1 : -1;
    }

    // Defend state
    const canDefend =
      input.defendHeld &&
      f.guardBreakTimer <= 0 &&
      f.attack.phase === 'none' &&
      !f.grapple.active &&
      !f.diveActive;
    if (canDefend) {
      if (!f.defending) {
        f.defending = true;
        f.defendTimer = 0;
      } else {
        f.defendTimer += dt;
      }
      f.posture = Math.max(0, f.posture - PHYSICS.POSTURE_DRAIN_PER_SEC * dt);
      if (f.posture <= 0) {
        f.guardBreakTimer = 1.1;
        f.defending = false;
        f.hitstunTimer = 0.75;
        f.vy = 8;
      }
    } else {
      f.defending = false;
      f.defendTimer = 0;
      f.posture = Math.min(100, f.posture + PHYSICS.POSTURE_REGEN_PER_SEC * dt);
    }

    // Hook & Rope Grapple attachment / release
    if (input.grapplePressed) {
      if (f.grapple.active) {
        releaseGrapple(state, f);
      } else {
        const target = findGrappleTarget(state, f, input);
        if (target) {
          const originX = f.x;
          const originY = f.y + f.height * 0.58;
          const dist = Math.hypot(target.x - originX, target.y - originY);
          const stepDist = PHYSICS.GRAPPLE_HOOK_SPEED * dt;
          const instantAttach = dist <= stepDist + 0.65;

          f.grapple = {
            active: true,
            phase: instantAttach ? 'attached' : 'firing',
            targetType: target.type,
            targetPlayerId: target.targetPlayerId,
            anchorX: target.x,
            anchorY: target.y,
            hookX: instantAttach ? target.x : originX + ((target.x - originX) / (dist || 1)) * stepDist,
            hookY: instantAttach ? target.y : originY + ((target.y - originY) / (dist || 1)) * stepDist,
            length: Math.max(PHYSICS.GRAPPLE_MIN_LENGTH, dist),
            maxLength: PHYSICS.GRAPPLE_RANGE,
            swingSpeed: Math.hypot(f.vx, f.vy),
            attachedTime: 0,
          };
          f.diveActive = false;

          state.events.push({
            type: 'grapple_fire',
            x: originX,
            y: originY,
            fighterId: f.id,
          });

          if (instantAttach) {
            const m = recordMovementVerb(f, 'grapple', state.elapsed);
            triggerMechEvent(state, f, m);
            state.events.push({
              type: 'grapple_attach',
              x: target.x,
              y: target.y,
              fighterId: f.id,
            });
          }
        }
      }
    }

    // Active Hook Flight, Pendulum Swing & Reel-In Pull
    if (f.grapple.active) {
      // Update dynamic anchor if hooking another fighter
      if (f.grapple.targetType === 'player' && f.grapple.targetPlayerId !== null) {
        const other = state.fighters.find((o) => o.id === f.grapple.targetPlayerId);
        if (!other || !other.alive) {
          releaseGrapple(state, f);
        } else {
          f.grapple.anchorX = other.x;
          f.grapple.anchorY = other.y + other.height * 0.55;
        }
      }

      if (f.grapple.active && f.grapple.phase === 'firing') {
        // Advance flying iron hook toward surface/player
        const hx = f.grapple.anchorX - f.grapple.hookX;
        const hy = f.grapple.anchorY - f.grapple.hookY;
        const rem = Math.hypot(hx, hy);
        const stepDist = PHYSICS.GRAPPLE_HOOK_SPEED * dt;
        if (rem <= stepDist + 0.15) {
          f.grapple.hookX = f.grapple.anchorX;
          f.grapple.hookY = f.grapple.anchorY;
          f.grapple.phase = 'attached';
          const curDist = Math.hypot(
            f.grapple.anchorX - f.x,
            f.grapple.anchorY - (f.y + f.height * 0.55)
          );
          f.grapple.length = Math.max(PHYSICS.GRAPPLE_MIN_LENGTH, curDist);
          const m = recordMovementVerb(f, 'grapple', state.elapsed);
          triggerMechEvent(state, f, m);
          state.events.push({
            type: 'grapple_attach',
            x: f.grapple.anchorX,
            y: f.grapple.anchorY,
            fighterId: f.id,
          });
        } else {
          f.grapple.hookX += (hx / rem) * stepDist;
          f.grapple.hookY += (hy / rem) * stepDist;
          // Gravity still acts lightly during the brief 2-3 frame hook throw
          f.vy += PHYSICS.GRAVITY * dt;
        }
      } else if (f.grapple.active && f.grapple.phase === 'attached') {
        f.grapple.attachedTime += dt;
        f.grapple.hookX = f.grapple.anchorX;
        f.grapple.hookY = f.grapple.anchorY;

        const pivotX = f.grapple.anchorX;
        const pivotY = f.grapple.anchorY;
        const ox = f.x;
        const oy = f.y + f.height * 0.55;
        let dx = ox - pivotX;
        let dy = oy - pivotY;
        let dist = Math.hypot(dx, dy) || 0.01;

        // PULL (only available while attached!)
        if (input.pullHeld) {
          if (f.grapple.targetType === 'surface') {
            f.grapple.length = Math.max(
              PHYSICS.GRAPPLE_MIN_LENGTH,
              f.grapple.length - PHYSICS.GRAPPLE_PULL_SPEED * dt
            );
            const nx = -dx / dist;
            const ny = -dy / dist;
            f.vx += nx * 48 * dt;
            f.vy += ny * 48 * dt;
          } else if (f.grapple.targetPlayerId !== null) {
            const other = state.fighters.find((o) => o.id === f.grapple.targetPlayerId);
            if (other && other.alive) {
              const nx = -dx / dist;
              const ny = -dy / dist;
              f.vx += nx * 30 * dt;
              f.vy += ny * 30 * dt;
              other.vx -= nx * 42 * dt;
              other.vy -= ny * 42 * dt + 5 * dt;
              f.grapple.length = Math.max(
                PHYSICS.GRAPPLE_MIN_LENGTH,
                f.grapple.length - PHYSICS.GRAPPLE_PULL_SPEED * 0.9 * dt
              );
            }
          }
        }

        // Apply gravity while swinging on rope
        f.vy += PHYSICS.GRAVITY * dt;

        // Pump swing tangentially with moveX
        if (input.moveX !== 0) {
          f.vx += input.moveX * PHYSICS.GRAPPLE_SWING_PUMP * dt;
        }

        // Taut rope pendulum constraint
        dx = f.x - pivotX;
        dy = f.y + f.height * 0.55 - pivotY;
        dist = Math.hypot(dx, dy) || 0.01;

        if (dist > f.grapple.length && f.grapple.targetType === 'surface') {
          const nx = dx / dist;
          const ny = dy / dist;
          f.x = pivotX + nx * f.grapple.length;
          f.y = pivotY + ny * f.grapple.length - f.height * 0.55;
          const radialVel = f.vx * nx + f.vy * ny;
          if (radialVel > 0) {
            f.vx -= radialVel * nx;
            f.vy -= radialVel * ny;
          }
          if (ny < -0.1) {
            const speed = Math.hypot(f.vx, f.vy);
            f.grapple.swingSpeed = Math.max(f.grapple.swingSpeed, speed);
            if (speed > 7.5) {
              recordMovementVerb(f, 'swing', state.elapsed, speed);
            }
          }
        }

        // Release grapple on Jump or Dive or max duration
        if (
          f.jumpBufferTimer > 0 ||
          input.divePressed ||
          f.grapple.attachedTime > PHYSICS.GRAPPLE_MAX_DURATION
        ) {
          const savedSwingSpeed = Math.max(f.grapple.swingSpeed, Math.hypot(f.vx, f.vy));
          releaseGrapple(state, f);
          if (input.divePressed) {
            startDive(state, f, input, savedSwingSpeed);
          } else if (f.jumpBufferTimer > 0) {
            f.jumpBufferTimer = 0;
            // Momentum-preserving slingshot release!
            if (Math.abs(f.vx) > 6) f.vx *= 1.12;
            f.vy = Math.max(f.vy + 7.2, PHYSICS.JUMP_VELOCITY * 0.85);
            state.events.push({ type: 'jump', x: f.x, y: f.y, fighterId: f.id });
          }
        }
      }
    }

    // Attack state machine
    updateAttack(state, f, dt, input);

    // Movement Actions (Dash, Slide, Jump, Double Jump, Wall Jump, Dive)
    if (f.dashTimer > 0) {
      f.dashTimer = Math.max(0, f.dashTimer - dt);
      // Bulldozer Mech ram collision check!
      if (f.activeMech?.id === 'bulldozer') {
        for (const other of state.fighters) {
          if (!other.alive || other.id === f.id || other.intangibleToPlayers) continue;
          const overlapX = Math.abs(other.x - f.x) < (f.width + other.width) * 0.65;
          const overlapY = Math.abs(other.y - f.y) < f.height * 0.85;
          if (overlapX && overlapY && other.hitFlashTimer <= 0) {
            applyKnockback(
              state,
              other,
              f,
              f.facing,
              0.55,
              19.5 * f.activeMech.power,
              16
            );
          }
        }
      }
    } else if (f.slideTimer > 0) {
      f.slideTimer = Math.max(0, f.slideTimer - dt);
      f.height = PHYSICS.SLIDE_HEIGHT;
      // Friction decelerates slide slightly while keeping momentum
      f.vx *= Math.max(0, 1 - 1.35 * dt);
      if (f.slideTimer <= 0) {
        f.height = PHYSICS.FIGHTER_HEIGHT;
        if (f.activeMech?.id === 'thunderbolt') {
          triggerRadialShockwave(
            state,
            f,
            3.6,
            16.5,
            12,
            MECH_DEFINITIONS.thunderbolt.color,
            'thunderbolt'
          );
        }
      }
    } else {
      f.height = PHYSICS.FIGHTER_HEIGHT;
    }

    // Trigger Dash
    if (input.dashPressed && f.dashCooldown <= 0 && !f.defending && !f.grapple.active) {
      const dx = input.moveX !== 0 ? input.moveX : f.facing;
      const dy = input.moveY > 0 ? 0.35 : 0;
      const len = Math.hypot(dx, dy) || 1;
      f.dashDirX = dx / len;
      f.dashDirY = dy / len;
      f.dashTimer = PHYSICS.DASH_DURATION;
      f.dashCooldown = PHYSICS.DASH_COOLDOWN;
      f.slideTimer = 0;
      f.diveActive = false;
      f.vx = f.dashDirX * PHYSICS.DASH_SPEED;
      f.vy = f.dashDirY * PHYSICS.DASH_SPEED * 0.75;
      f.squashX = 1.28;
      f.squashY = 0.76;

      const m = recordMovementVerb(f, 'dash', state.elapsed);
      triggerMechEvent(state, f, m);
      state.events.push({
        type: 'dash',
        x: f.x,
        y: f.y + 0.6,
        vx: f.vx,
        vy: f.vy,
        fighterId: f.id,
        color: f.archetype.accentColor,
      });
    }

    // Trigger Slide (grounded only)
    if (
      (input.slidePressed || (input.slideHeld && Math.abs(f.vx) > 6 && f.slideTimer <= 0)) &&
      f.grounded &&
      f.slideCooldown <= 0 &&
      !f.defending &&
      f.slideTimer <= 0
    ) {
      f.slideTimer = PHYSICS.SLIDE_DURATION;
      f.slideCooldown = PHYSICS.SLIDE_COOLDOWN;
      f.dashTimer = 0;
      const boostDir = input.moveX !== 0 ? Math.sign(input.moveX) : f.facing;
      f.facing = boostDir as 1 | -1;
      f.vx = boostDir * Math.max(Math.abs(f.vx) * 1.15, PHYSICS.SLIDE_SPEED);
      f.squashX = 1.25;
      f.squashY = 0.65;

      const m = recordMovementVerb(f, 'slide', state.elapsed);
      triggerMechEvent(state, f, m);
      state.events.push({ type: 'slide', x: f.x, y: f.y, fighterId: f.id });
    }

    // Trigger Dive (airborne only!)
    if (input.divePressed && !f.grounded && !f.diveActive && !f.grapple.active) {
      startDive(state, f, input);
    }

    // Trigger Jump / Wall Jump / Double Jump
    if (f.jumpBufferTimer > 0 && !f.grapple.active) {
      if (f.grounded || f.coyoteTimer > 0) {
        // Normal Ground Jump — preserves horizontal velocity!
        f.jumpBufferTimer = 0;
        f.grounded = false;
        f.coyoteTimer = 0;
        f.slideTimer = 0;
        f.diveActive = false;
        f.vy = PHYSICS.JUMP_VELOCITY;
        f.squashX = 0.82;
        f.squashY = 1.24;
        const m = recordMovementVerb(f, 'jump', state.elapsed);
        triggerMechEvent(state, f, m);
        state.events.push({ type: 'jump', x: f.x, y: f.y, fighterId: f.id });
      } else if (f.onWall !== 0 || f.wallCoyoteTimer > 0) {
        // Wall Jump!
        const wallSide = f.onWall !== 0 ? f.onWall : f.lastWallSide;
        f.jumpBufferTimer = 0;
        f.onWall = 0;
        f.wallCoyoteTimer = 0;
        f.diveActive = false;
        f.vx = -wallSide * PHYSICS.WALL_JUMP_VX;
        f.vy = PHYSICS.WALL_JUMP_VY;
        f.facing = (-wallSide) as 1 | -1;
        f.doubleJumpAvailable = true;
        f.squashX = 0.82;
        f.squashY = 1.22;

        const m = recordMovementVerb(f, 'wall_jump', state.elapsed);
        triggerMechEvent(state, f, m);
        state.events.push({
          type: 'wall_jump',
          x: f.x + wallSide * 0.4,
          y: f.y + 0.7,
          fighterId: f.id,
        });
      } else if (f.doubleJumpAvailable) {
        // Double Jump! (NO Air Recovery!)
        f.jumpBufferTimer = 0;
        f.doubleJumpAvailable = false;
        f.diveActive = false;
        f.dashTimer = 0;
        f.vy = PHYSICS.DOUBLE_JUMP_VELOCITY;
        if (input.moveX !== 0) {
          // Allow slight directional influence while preserving momentum
          const targetVx = input.moveX * Math.max(PHYSICS.MAX_RUN_SPEED * 0.9, Math.abs(f.vx));
          f.vx = f.vx * 0.55 + targetVx * 0.45;
        }
        f.squashX = 0.84;
        f.squashY = 1.22;

        const m = recordMovementVerb(f, 'double_jump', state.elapsed);
        triggerMechEvent(state, f, m);
        state.events.push({
          type: 'double_jump',
          x: f.x,
          y: f.y,
          fighterId: f.id,
          color: f.archetype.accentColor,
        });
      }
    }

    // Variable jump height cut when releasing jump early
    if (!input.jumpHeld && f.vy > 4.5 && !f.grapple.active && f.dashTimer <= 0) {
      f.vy *= Math.pow(PHYSICS.JUMP_CUT_MULTIPLIER, dt * 14);
    }

    // Horizontal Run / Air Control (when not locked in dash/slide/grapple)
    if (!f.grapple.active && f.dashTimer <= 0 && f.slideTimer <= 0 && !f.diveActive) {
      const speedMult = f.defending ? 0.38 : 1.0;
      const targetMax = PHYSICS.MAX_RUN_SPEED * speedMult;

      if (f.grounded) {
        if (input.moveX !== 0) {
          // Preserve momentum if already going faster in same direction (e.g. from dash/swing)
          const sameDir = Math.sign(f.vx) === Math.sign(input.moveX);
          if (!sameDir || Math.abs(f.vx) < targetMax) {
            const nextVx = f.vx + input.moveX * PHYSICS.RUN_ACCEL * dt;
            f.vx = clamp(nextVx, -targetMax, targetMax);
          } else {
            f.vx *= Math.max(0, 1 - 1.5 * dt);
          }
          f.runStreakTime += dt;
          if (f.runStreakTime >= 0.16) {
            f.runStreakTime = -0.35; // cadence for recording 'run'
            recordMovementVerb(f, 'run', state.elapsed);
          }
        } else {
          f.runStreakTime = 0;
          const decel = PHYSICS.RUN_DECEL * dt;
          if (Math.abs(f.vx) <= decel) f.vx = 0;
          else f.vx -= Math.sign(f.vx) * decel;
        }
      } else {
        f.runStreakTime = 0;
        if (input.moveX !== 0) {
          const sameDir = Math.sign(f.vx) === Math.sign(input.moveX);
          if (!sameDir || Math.abs(f.vx) < targetMax) {
            f.vx += input.moveX * PHYSICS.AIR_ACCEL * dt;
          }
        } else {
          f.vx *= Math.max(0, 1 - PHYSICS.AIR_DRAG * 0.25 * dt);
        }
      }
    }

    // Apply Gravity when not grounded, not dashing, and not swinging
    if (!f.grounded && f.dashTimer <= 0 && !f.grapple.active) {
      f.vy += PHYSICS.GRAVITY * dt;
      if (f.onWall !== 0 && f.vy < PHYSICS.WALL_SLIDE_MAX_FALL && input.moveX === f.onWall) {
        f.vy = PHYSICS.WALL_SLIDE_MAX_FALL;
      } else if (f.vy < PHYSICS.MAX_FALL_SPEED && !f.diveActive) {
        f.vy = PHYSICS.MAX_FALL_SPEED;
      }
    }

    // Conveyor belt ground push
    if (f.grounded && f.groundPlatformId) {
      const gp = state.platforms.find((p) => p.id === f.groundPlatformId);
      if (gp && gp.kind === 'conveyor' && gp.conveyorSpeed) {
        f.x += gp.conveyorSpeed * dt;
      }
    }

    // Distance-synced stride cycle for clean gait animation
    if (f.grounded && f.slideTimer <= 0) {
      f.strideDistance += Math.abs(f.vx) * dt;
    }

    integrateAndCollide(state, f, dt, input);
    checkHazardsAndBlastBounds(state, f);
  }

  // 4. Player-vs-Player body separation (skipped if Phantom-intangible or teammate!)
  for (let i = 0; i < state.fighters.length; i++) {
    const a = state.fighters[i];
    if (!a.alive || a.intangibleToPlayers) continue;
    for (let j = i + 1; j < state.fighters.length; j++) {
      const b = state.fighters[j];
      if (!b.alive || b.intangibleToPlayers || areTeammates(state, a, b)) continue;
      const dx = b.x - a.x;
      const dy = b.y + b.height * 0.5 - (a.y + a.height * 0.5);
      const minX = (a.width + b.width) * 0.45;
      const minY = (a.height + b.height) * 0.42;
      if (Math.abs(dx) < minX && Math.abs(dy) < minY) {
        const pushDir = dx >= 0 ? 1 : -1;
        const overlap = minX - Math.abs(dx);
        a.x -= pushDir * overlap * 0.45;
        b.x += pushDir * overlap * 0.45;
        a.vx -= pushDir * PHYSICS.FIGHTER_SEPARATION_FORCE * dt;
        b.vx += pushDir * PHYSICS.FIGHTER_SEPARATION_FORCE * dt;
      }
    }
  }

  // 4.5 King of the Platform zone scoring & rotation
  if (!state.isTutorial && state.gameMode === 'king_of_platform' && state.kingZone) {
    const kz = state.kingZone;
    kz.shiftTimer -= dt;
    if (kz.shiftTimer <= 0 && state.kingSpots.length > 1) {
      kz.spotIndex = (kz.spotIndex + 1) % state.kingSpots.length;
      const spot = state.kingSpots[kz.spotIndex];
      kz.x = spot.x;
      kz.y = spot.y;
      kz.w = spot.w;
      kz.h = spot.h;
      kz.shiftTimer = 24;
    }

    const occupants: FighterState[] = [];
    for (const f of state.fighters) {
      if (!f.alive) continue;
      const fx = f.x;
      const fy = f.y + f.height * 0.5;
      if (
        Math.abs(fx - kz.x) <= kz.w * 0.5 + 0.2 &&
        Math.abs(fy - kz.y) <= kz.h * 0.5 + 0.35
      ) {
        occupants.push(f);
      }
    }

    if (occupants.length === 1) {
      kz.contested = false;
      kz.controllerId = occupants[0].id;
      occupants[0].kingScore = Math.min(100, occupants[0].kingScore + dt * 7.8);
    } else if (occupants.length > 1) {
      kz.contested = true;
      kz.controllerId = null;
    } else {
      kz.contested = false;
      kz.controllerId = null;
    }
  }

  // 5. Tutorial dummy/bot respawn or Mode Win Conditions
  if (state.isTutorial) {
    const deadBot = state.fighters.find((f) => !f.isHuman && !f.alive);
    if (deadBot) {
      state.dummyRespawnTimer = (state.dummyRespawnTimer ?? 0) - dt;
      if (state.dummyRespawnTimer <= 0) {
        const homePlat =
          state.platforms.find(
            (p) =>
              !p.broken &&
              p.kind === 'solid' &&
              Math.abs(p.x - (state.tutorialBotHomeX ?? p.x)) <= p.w * 0.5
          ) ??
          state.platforms.find((p) => !p.broken && p.kind === 'solid') ??
          state.platforms[0];
        const fallbackSp = {
          x: state.tutorialBotHomeX ?? homePlat?.x ?? (state.tutorialMode === 'crucible' ? 4.5 : 8.5),
          y: homePlat ? homePlat.y + homePlat.h * 0.5 + 1.4 : 3.2,
        };
        deadBot.alive = true;
        deadBot.x = fallbackSp.x;
        deadBot.y = fallbackSp.y;
        deadBot.vx = 0;
        deadBot.vy = 0;
        deadBot.facing = -1;
        deadBot.damagePercent = 0;
        deadBot.hitstunTimer = 0;
        deadBot.hitFlashTimer = 0;
        deadBot.ragdollAngle = 0;
        deadBot.ragdollSpin = 0;
        deadBot.lastHitBy = null;
        deadBot.doubleJumpAvailable = true;
        state.events.push({ type: 'land', x: deadBot.x, y: deadBot.y, fighterId: deadBot.id });
      }
    }
  } else if (!state.matchFinished) {
    const timedOut =
      state.timeLimitSeconds !== null && state.elapsed >= state.timeLimitSeconds;

    if (state.gameMode === 'team_chaos') {
      const team0Stocks = state.fighters
        .filter((f) => f.teamId === 0)
        .reduce((acc, f) => acc + (f.alive || f.respawnTimer > 0 ? Math.max(0, f.stocks) : 0), 0);
      const team1Stocks = state.fighters
        .filter((f) => f.teamId === 1)
        .reduce((acc, f) => acc + (f.alive || f.respawnTimer > 0 ? Math.max(0, f.stocks) : 0), 0);
      state.teamScores = [team0Stocks, team1Stocks];

      if (team0Stocks <= 0 || team1Stocks <= 0 || timedOut) {
        state.finishDelayTimer += dt;
        if (state.finishDelayTimer >= 0.45 || timedOut) {
          state.matchFinished = true;
          if (team0Stocks !== team1Stocks) {
            state.winningTeam = team0Stocks > team1Stocks ? 0 : 1;
          } else {
            const t0Kos = state.fighters.filter((f) => f.teamId === 0).reduce((s, f) => s + f.kos, 0);
            const t1Kos = state.fighters.filter((f) => f.teamId === 1).reduce((s, f) => s + f.kos, 0);
            state.winningTeam = t0Kos >= t1Kos ? 0 : 1;
          }
          const topTeamMember = state.fighters
            .filter((f) => f.teamId === state.winningTeam)
            .sort((a, b) => b.stocks - a.stocks || b.kos - a.kos)[0];
          state.winnerId = topTeamMember?.id ?? null;
        }
      }
    } else if (state.gameMode === 'king_of_platform') {
      const crowned = state.fighters.find((f) => f.kingScore >= 100);
      if (crowned || timedOut) {
        state.matchFinished = true;
        const sorted = [...state.fighters].sort(
          (a, b) => b.kingScore - a.kingScore || b.kos - a.kos || a.deaths - b.deaths
        );
        state.winnerId = sorted[0]?.id ?? null;
      }
    } else if (state.gameMode === 'stock_brawl') {
      const withStocks = state.fighters.filter((f) => f.stocks > 0);
      if (withStocks.length <= 1 || timedOut) {
        state.finishDelayTimer += dt;
        if (state.finishDelayTimer >= 0.5 || timedOut) {
          state.matchFinished = true;
          const sorted = [...state.fighters].sort(
            (a, b) =>
              b.stocks - a.stocks ||
              b.kos - a.kos ||
              a.deaths - b.deaths ||
              a.damagePercent - b.damagePercent
          );
          state.winnerId = sorted[0]?.id ?? null;
        }
      }
    } else {
      const aliveFighters = state.fighters.filter((f) => f.alive);
      if (aliveFighters.length <= 1) {
        state.finishDelayTimer += dt;
        if (state.finishDelayTimer >= 0.55) {
          state.matchFinished = true;
          state.winnerId = aliveFighters.length === 1 ? aliveFighters[0].id : null;
        }
      }
    }
  }
}

function releaseGrapple(state: SimulationState, f: FighterState): void {
  if (!f.grapple.active) return;
  f.grapple.active = false;
  f.grapple.phase = 'none';
  state.events.push({
    type: 'grapple_release',
    x: f.x,
    y: f.y + f.height * 0.55,
    fighterId: f.id,
  });
}

function startDive(
  state: SimulationState,
  f: FighterState,
  input: PlayerInput,
  explicitSwingSpeed?: number
): void {
  f.diveActive = true;
  f.dashTimer = 0;
  const dir = input.moveX !== 0 ? Math.sign(input.moveX) : f.facing;
  f.facing = dir as 1 | -1;
  f.vx = dir * Math.max(Math.abs(f.vx) * 0.9, PHYSICS.DIVE_SPEED_X);
  f.vy = Math.min(f.vy, PHYSICS.DIVE_SPEED_Y);
  f.diveSpeed = Math.hypot(f.vx, f.vy);
  f.squashX = 0.78;
  f.squashY = 1.28;

  const m = recordMovementVerb(f, 'dive', state.elapsed, explicitSwingSpeed ?? f.diveSpeed);
  triggerMechEvent(state, f, m);
  state.events.push({
    type: 'dive_start',
    x: f.x,
    y: f.y + 0.5,
    fighterId: f.id,
  });
}

function updateAttack(
  state: SimulationState,
  f: FighterState,
  dt: number,
  input: PlayerInput
): void {
  if (
    input.attackPressed &&
    f.attack.phase === 'none' &&
    f.attackCooldown <= 0 &&
    !f.defending
  ) {
    const dirX = input.moveX !== 0 ? input.moveX : f.facing;
    const dirY = input.moveY > 0 ? 0.55 : input.moveY < 0 ? -0.35 : 0.25;
    const momentumBonus = Math.min(8.0, Math.hypot(f.vx, f.vy) * 0.38);
    f.attack = {
      phase: 'windup',
      timer: PHYSICS.ATTACK_WINDUP,
      dirX,
      dirY,
      hitIds: [],
      momentumBonus,
    };
    f.attackCooldown = PHYSICS.ATTACK_COOLDOWN;
    state.events.push({
      type: 'attack_swing',
      x: f.x + f.facing * 0.8,
      y: f.y + f.height * 0.55,
      fighterId: f.id,
      color: f.archetype.accentColor,
    });
  }

  if (f.attack.phase === 'none') return;

  f.attack.timer -= dt;
  if (f.attack.phase === 'windup' && f.attack.timer <= 0) {
    f.attack.phase = 'active';
    f.attack.timer = PHYSICS.ATTACK_ACTIVE;
    // Slight forward lunge on attack active
    if (!f.grapple.active) {
      f.vx += f.facing * 3.2;
    }
  } else if (f.attack.phase === 'active') {
    // Aggression breaks remaining spawn protection early
    f.spawnInvulnTimer = 0;
    // Check hitbox against other fighters
    const hitCenterX = f.x + f.facing * 0.95;
    const hitCenterY = f.y + f.height * 0.55;
    for (const other of state.fighters) {
      if (
        !other.alive ||
        other.id === f.id ||
        other.intangibleToPlayers ||
        areTeammates(state, f, other) ||
        f.attack.hitIds.includes(other.id)
      ) {
        continue;
      }
      const dx = other.x - hitCenterX;
      const dy = other.y + other.height * 0.5 - hitCenterY;
      if (Math.hypot(dx, dy) <= PHYSICS.ATTACK_RANGE) {
        f.attack.hitIds.push(other.id);
        const baseForce = 13.5 + f.attack.momentumBonus;
        applyKnockback(state, other, f, f.facing, 0.52 + f.attack.dirY * 0.3, baseForce, 14);
      }
    }

    // Check destructible crates & barrels
    for (const plat of state.platforms) {
      if (plat.broken || plat.kind !== 'destructible') continue;
      if (Math.hypot(plat.x - hitCenterX, plat.y - hitCenterY) <= PHYSICS.ATTACK_RANGE + 0.5) {
        damageCrate(state, plat, 18);
      }
    }
    for (const haz of state.hazards) {
      if (haz.kind === 'barrel' && !haz.exploded) {
        if (Math.hypot(haz.x - hitCenterX, haz.y - hitCenterY) <= PHYSICS.ATTACK_RANGE + 0.4) {
          detonateBarrel(state, haz, f.id);
        }
      }
    }

    if (f.attack.timer <= 0) {
      f.attack.phase = 'recovery';
      f.attack.timer = PHYSICS.ATTACK_RECOVERY;
    }
  } else if (f.attack.phase === 'recovery' && f.attack.timer <= 0) {
    f.attack.phase = 'none';
  }
}

function integrateAndCollide(
  state: SimulationState,
  f: FighterState,
  dt: number,
  input: PlayerInput
): void {
  const prevY = f.y;
  const prevX = f.x;

  // Move X
  f.x += f.vx * dt;
  const halfW = f.width * 0.5;
  f.onWall = 0;

  for (const plat of state.platforms) {
    if (plat.broken || plat.kind === 'passthrough') continue;
    const b = getPlatformBounds(plat);
    // Vertical overlap check
    if (f.y + f.height > b.bottom + 0.08 && f.y < b.top - 0.08) {
      if (f.x + halfW > b.left && prevX + halfW <= b.left + 0.15) {
        f.x = b.left - halfW;
        if (f.hitstunTimer > 0 && Math.abs(f.vx) > 8) {
          f.vx = -f.vx * 0.55; // wall bounce!
        } else {
          f.vx = 0;
          if (!f.grounded && plat.h >= 2.2) {
            f.onWall = 1;
            f.lastWallSide = 1;
            f.wallCoyoteTimer = PHYSICS.WALL_COYOTE_TIME;
          }
        }
      } else if (f.x - halfW < b.right && prevX - halfW >= b.right - 0.15) {
        f.x = b.right + halfW;
        if (f.hitstunTimer > 0 && Math.abs(f.vx) > 8) {
          f.vx = -f.vx * 0.55;
        } else {
          f.vx = 0;
          if (!f.grounded && plat.h >= 2.2) {
            f.onWall = -1;
            f.lastWallSide = -1;
            f.wallCoyoteTimer = PHYSICS.WALL_COYOTE_TIME;
          }
        }
      }
    }
  }

  if (f.onWall === 0) {
    f.wallCoyoteTimer = Math.max(0, f.wallCoyoteTimer - dt);
  }

  // Move Y
  f.y += f.vy * dt;
  const wasGrounded = f.grounded;
  f.grounded = false;
  f.groundPlatformId = null;

  for (const plat of state.platforms) {
    if (plat.broken) continue;
    const b = getPlatformBounds(plat);
    const overlapX = f.x + halfW > b.left + 0.04 && f.x - halfW < b.right - 0.04;
    if (!overlapX) continue;

    // Top landing
    const dropThrough = plat.kind === 'passthrough' && input.moveY < 0 && !f.diveActive;
    if (!dropThrough && f.vy <= 0 && prevY >= b.top - 0.22 && f.y <= b.top) {
      f.y = b.top;
      const impactVy = Math.abs(f.vy);
      f.vy = 0;
      f.grounded = true;
      f.groundPlatformId = plat.id;
      f.doubleJumpAvailable = true;
      f.coyoteTimer = PHYSICS.COYOTE_TIME;

      if (plat.kind === 'crumbling' && (plat.crumbleTimer ?? 0) <= 0) {
        plat.crumbleTimer = 0.85;
      }

      if (!wasGrounded) {
        f.squashX = clamp(1 + impactVy * 0.015, 1.08, 1.38);
        f.squashY = clamp(1 - impactVy * 0.015, 0.64, 0.92);

        if (f.diveActive) {
          f.diveActive = false;
          if (f.activeMech?.id === 'meteor') {
            triggerRadialShockwave(
              state,
              f,
              4.2,
              18.5,
              18,
              MECH_DEFINITIONS.meteor.color,
              'meteor'
            );
          } else if (f.activeMech?.id === 'comet') {
            const pow = f.activeMech.power;
            triggerRadialShockwave(
              state,
              f,
              4.0 + pow * 0.5,
              15.5 * pow,
              16 * pow,
              MECH_DEFINITIONS.comet.color,
              'comet'
            );
          } else {
            triggerRadialShockwave(state, f, 2.5, 11.0, 9, f.archetype.accentColor);
          }
          state.trauma = Math.min(1, state.trauma + 0.38);
          state.events.push({ type: 'dive_impact', x: f.x, y: f.y, fighterId: f.id });
        } else if (impactVy > 6) {
          state.events.push({ type: 'land', x: f.x, y: f.y, fighterId: f.id });
        }
      }
    } else if (
      plat.kind !== 'passthrough' &&
      f.vy > 0 &&
      prevY + f.height <= b.bottom + 0.2 &&
      f.y + f.height >= b.bottom
    ) {
      // Ceiling bonk
      f.y = b.bottom - f.height;
      f.vy = -1.5;
    }
  }

  if (!f.grounded) {
    f.coyoteTimer = Math.max(0, f.coyoteTimer - dt);
  }

  // Ledge Grab Proximity Check (airborne, falling, not holding down, within LEDGE_GRAB_RANGE)
  if (
    !f.grounded &&
    !f.grapple.active &&
    !f.diveActive &&
    f.dashTimer <= 0 &&
    f.ledgeCooldown <= 0 &&
    f.vy < 2.0 &&
    input.moveY >= 0 &&
    f.hitstunTimer <= 0
  ) {
    const handX = f.x;
    const handY = f.y + f.height * 0.78;
    for (const plat of state.platforms) {
      if (plat.broken || !plat.ledgeGrabbable) continue;
      const b = getPlatformBounds(plat);
      // Left corner of platform (fighter approaching from left, facing right)
      const distLeft = Math.hypot(handX - b.left, handY - b.top);
      if (distLeft <= PHYSICS.LEDGE_GRAB_RANGE && f.x < b.left + 0.2) {
        f.ledgeGrab = {
          active: true,
          platformId: plat.id,
          side: 1,
          ledgeX: b.left,
          ledgeY: b.top,
          timer: 0,
        };
        f.vx = 0;
        f.vy = 0;
        recordMovementVerb(f, 'ledge_grab', state.elapsed);
        state.events.push({ type: 'ledge_grab', x: b.left, y: b.top, fighterId: f.id });
        break;
      }
      // Right corner of platform
      const distRight = Math.hypot(handX - b.right, handY - b.top);
      if (distRight <= PHYSICS.LEDGE_GRAB_RANGE && f.x > b.right - 0.2) {
        f.ledgeGrab = {
          active: true,
          platformId: plat.id,
          side: -1,
          ledgeX: b.right,
          ledgeY: b.top,
          timer: 0,
        };
        f.vx = 0;
        f.vy = 0;
        recordMovementVerb(f, 'ledge_grab', state.elapsed);
        state.events.push({ type: 'ledge_grab', x: b.right, y: b.top, fighterId: f.id });
        break;
      }
    }
  }
}

function checkHazardsAndBlastBounds(state: SimulationState, f: FighterState): void {
  if (!f.alive) return;

  // Lethal Blast Bounds
  const b = state.blastBounds;
  if (f.x < b.left || f.x > b.right || f.y < b.bottom || f.y > b.top) {
    eliminateFighter(state, f, null);
    return;
  }

  // Arena Hazards (respect spawn invulnerability)
  if (f.spawnInvulnTimer > 0) return;
  for (const haz of state.hazards) {
    if (haz.kind === 'lava') {
      if (f.y < haz.y + haz.h * 0.5) {
        eliminateFighter(state, f, null);
        return;
      }
    } else if (haz.kind === 'crusher' && haz.active) {
      const overlapX = Math.abs(f.x - haz.x) < (f.width + haz.w) * 0.48;
      const overlapY =
        f.y < haz.y + haz.h * 0.5 && f.y + f.height > haz.y - haz.h * 0.5;
      if (overlapX && overlapY) {
        eliminateFighter(state, f, null);
        return;
      }
    } else if (haz.kind === 'barrel' && !haz.exploded && f.diveActive) {
      if (Math.hypot(f.x - haz.x, f.y + 0.5 - haz.y) < 1.35) {
        detonateBarrel(state, haz, f.id);
      }
    }
  }
}

export function buildMatchResult(
  state: SimulationState,
  arenaName: string,
  perspectiveSlot = 0
): MatchResultSummary {
  const sorted = [...state.fighters].sort((a, b) => {
    if (state.gameMode === 'king_of_platform') {
      return b.kingScore - a.kingScore || b.kos - a.kos || a.deaths - b.deaths;
    }
    if (state.gameMode === 'team_chaos') {
      const aWin = a.teamId === state.winningTeam ? 1 : 0;
      const bWin = b.teamId === state.winningTeam ? 1 : 0;
      if (aWin !== bWin) return bWin - aWin;
      return b.stocks - a.stocks || b.kos - a.kos || a.deaths - b.deaths;
    }
    if (state.gameMode === 'stock_brawl') {
      return (
        b.stocks - a.stocks ||
        (b.alive ? 1 : 0) - (a.alive ? 1 : 0) ||
        b.kos - a.kos ||
        a.deaths - b.deaths
      );
    }
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (!a.alive && !b.alive) {
      return (b.eliminatedAt ?? 0) - (a.eliminatedAt ?? 0);
    }
    return b.kos - a.kos;
  });

  const standings = sorted.map((f, idx) => ({
    id: f.id,
    name: f.name,
    isHuman: f.isHuman,
    color: f.archetype.primaryColor,
    alive: f.alive,
    kos: f.kos,
    deaths: f.deaths,
    stocksLeft: f.stocks,
    teamId: f.teamId,
    kingScore: Math.round(f.kingScore),
    mechsTriggered: f.mechsTriggered,
    placement: idx + 1,
  }));

  const winner = sorted[0];
  const human =
    sorted.find((f) => f.isHuman && f.playerSlot === perspectiveSlot) ??
    sorted.find((f) => f.isHuman) ??
    sorted[0];
  const humanStanding = standings.find((s) => s.id === human.id)!;

  const humanWon =
    state.gameMode === 'team_chaos'
      ? Boolean(human.isHuman && state.winningTeam !== null && human.teamId === state.winningTeam)
      : Boolean(human.isHuman && winner && winner.id === human.id);

  const winnerName =
    state.gameMode === 'team_chaos'
      ? state.winningTeam === 0
        ? 'Crimson Team'
        : 'Teal Team'
      : winner?.name ?? 'Draw';

  const winnerColor =
    state.gameMode === 'team_chaos'
      ? state.winningTeam === 0
        ? '#d95d43'
        : '#54a897'
      : winner?.archetype.primaryColor ?? '#f43f5e';

  return {
    gameMode: state.gameMode,
    winnerId: winner?.id ?? null,
    winningTeam: state.winningTeam,
    winnerName,
    winnerColor,
    humanWon,
    humanPlacement: humanStanding.placement,
    totalFighters: state.fighters.length,
    durationSeconds: state.elapsed,
    humanKos: human.kos,
    humanMechs: human.mechsTriggered,
    arenaId: state.arenaId,
    arenaName,
    standings,
  };
}

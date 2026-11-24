import {
  ACADEMY_LEVELS,
  AcademyBotSpec,
  AcademyLevelDef,
  AcademyProgressState,
  formatAcademyItems,
} from './academyLevels';
import { FIGHTER_ARCHETYPES, MECH_DEFINITIONS } from './constants';
import {
  ArenaConfig,
  FighterState,
  Handedness,
  MechId,
  SimEvent,
  SimulationState,
  TutorialBotBehavior,
  TutorialMode,
  TutorialStepSnapshot,
} from './types';

export interface ActiveScenarioSetup {
  arena: ArenaConfig;
  bots: AcademyBotSpec[];
  paceScale: number;
  botBehavior: TutorialBotBehavior;
  botAggression: number;
  botHomeX: number;
  playerStartDamage?: number;
}

export interface CrucibleScenario {
  waveIndex: number;
  targetMech: MechId;
  scenarioName: string;
  instruction: string;
  hint: string;
  waypointX: number;
  waypointY: number;
  paceScale: number;
  arena: ArenaConfig;
  bots: AcademyBotSpec[];
}

export interface TutorialRunner {
  mode: TutorialMode;
  handedness: Handedness;
  stepIndex: number;
  totalSteps: number;
  completed: boolean;
  flags: Record<string, boolean>;
  academyProgress: AcademyProgressState;
  completedLevelIds: string[];
  failuresOnLevel: number;
  reteachMode: boolean;
  reroutedFrom: {
    levelIndex: number;
    levelNumber: number;
    title: string;
    reason: string;
  } | null;
  holdRunTime: number;
  mechUseWindow: number;
  seed: number;
  mechOrder: MechId[];
  currentScenario: CrucibleScenario | null;
  currentAcademySetup: ActiveScenarioSetup | null;
}

function createEmptyAcademyProgress(): AcademyProgressState {
  return {
    flags: {},
    counters: {},
    timers: {},
    recentHitTimer: 0,
    survivedSeconds: 0,
    tookDamageInStep: false,
    mechsSeen: [],
  };
}

function buildAcademyScenarioSetup(
  level: AcademyLevelDef,
  seed: number,
  reteachMode: boolean
): ActiveScenarioSetup {
  const paceOffset = reteachMode ? -0.08 : 0;
  return {
    arena: level.buildArena(seed + level.number * 37),
    bots: level.buildBots(seed + level.number * 37),
    paceScale: Math.max(0.68, Number((level.paceScale + paceOffset).toFixed(2))),
    botBehavior: level.botBehavior,
    botAggression: reteachMode ? Math.max(0, level.botAggression - 0.2) : level.botAggression,
    botHomeX: level.botHomeX,
    playerStartDamage: level.playerStartDamage,
  };
}

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ALL_MECHS: MechId[] = [
  'meteor',
  'phantom',
  'thunderbolt',
  'spider',
  'comet',
  'bulldozer',
];

function buildShuffledMechOrder(seed: number): MechId[] {
  const rng = createSeededRng(seed);
  const pool = [...ALL_MECHS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 5);
}

export function generateProceduralCrucibleScenario(
  waveIndex: number,
  seed: number,
  targetMechOverride?: MechId
): CrucibleScenario {
  const rng = createSeededRng(seed + waveIndex * 7919 + 131);
  const flip = rng() < 0.5 ? 1 : -1;
  const pickArch = () => {
    const pool = FIGHTER_ARCHETYPES.slice(1);
    return pool[Math.floor(rng() * pool.length)];
  };

  const mechPool = ALL_MECHS;
  const targetMech = targetMechOverride ?? mechPool[waveIndex % mechPool.length];
  const jitter = (amp: number) => (rng() - 0.5) * 2 * amp;
  // Ramp Crucible speed gradually from calm 0.86x on Wave 1 up to 1.0x on Wave 5
  const paceScale = Math.min(1.0, Number((0.86 + waveIndex * 0.035).toFixed(2)));

  const bot1Arch = pickArch();
  const bot2Arch = pickArch();

  if (targetMech === 'meteor') {
    const deckY = jitter(0.6);
    const perchX = flip * (-5.2 + jitter(1.2));
    const perchY = 5.4 + jitter(0.9);
    const enemyCenterX = flip * (2.5 + jitter(1.4));
    return {
      waveIndex,
      targetMech,
      scenarioName: 'Sky Crater Ambush',
      instruction:
        'Rivals are holding the lower courtyard. Leap from the upper perch, trigger METEOR (Jump → Dive), and shatter them with the landing shockwave!',
      hint: 'Jump → Dive above foes to detonate METEOR shockwave on impact',
      waypointX: enemyCenterX,
      waypointY: deckY + 1.8,
      paceScale,
      arena: {
        id: 'crucible',
        name: 'Mech Crucible · Meteor',
        subtitle: 'Procedural Sky Ambush',
        description: 'Strike enemies below using METEOR.',
        blastBounds: { left: -21, right: 21, top: 18, bottom: -10.5 },
        spawnPoints: [{ x: perchX, y: perchY + 1.2 }],
        platforms: [
          {
            id: 'cr-main',
            x: flip * 1.0,
            y: deckY - 0.6,
            w: 14.5 + rng() * 3.0,
            h: 1.4,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#575063',
          },
          {
            id: 'cr-perch',
            x: perchX,
            y: perchY,
            w: 4.8 + rng() * 1.4,
            h: 0.6,
            kind: 'passthrough',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#8c6b4d',
          },
          {
            id: 'cr-wall',
            x: flip * -10.5,
            y: 3.4,
            w: 1.1,
            h: 5.5,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#6b5e68',
          },
        ],
        anchors: [],
        hazards: [
          {
            id: 'cr-keg',
            kind: 'barrel',
            x: enemyCenterX + flip * 1.8,
            y: deckY + 0.7,
            w: 1.0,
            h: 1.2,
            baseY: deckY + 0.7,
            active: true,
            warningTimer: 0,
            cycleTimer: 0,
            exploded: false,
            respawnTimer: 0,
            knockback: 22,
            lethal: false,
          },
        ],
        skyColor: '#252833',
        fogColor: '#3d4554',
        accentColor: MECH_DEFINITIONS.meteor.color,
      },
      bots: [
        { x: enemyCenterX - 1.2, y: deckY + 1.2, archetypeId: bot1Arch.id, policy: 'brawler', name: bot1Arch.name },
        { x: enemyCenterX + 1.4, y: deckY + 1.2, archetypeId: bot2Arch.id, policy: 'opportunist', name: bot2Arch.name },
      ],
    };
  }

  if (targetMech === 'phantom') {
    const bridgeW = 10.5 + rng() * 2.5;
    const playerX = flip * (-3.2 + jitter(0.8));
    return {
      waveIndex,
      targetMech,
      scenarioName: 'Pincer Slip',
      instruction:
        'Two fighters are boxing you in! Trigger PHANTOM (Dash → Double Jump) to phase straight through them and counter-strike!',
      hint: 'Jump or run, Dash → Double Jump to phase through bodies, then Strike!',
      waypointX: -playerX,
      waypointY: 2.4,
      paceScale,
      arena: {
        id: 'crucible',
        name: 'Mech Crucible · Phantom',
        subtitle: 'Procedural Body-Phase Escape',
        description: 'Phase through encroaching fighters with PHANTOM.',
        blastBounds: { left: -21, right: 21, top: 18, bottom: -10.5 },
        spawnPoints: [{ x: playerX, y: 1.8 }],
        platforms: [
          {
            id: 'cr-bridge',
            x: 0,
            y: 0.2,
            w: bridgeW,
            h: 1.2,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#575063',
          },
          {
            id: 'cr-out-l',
            x: -10.2 - rng() * 1.4,
            y: 2.0 + jitter(0.8),
            w: 4.2,
            h: 0.8,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#6b5e68',
          },
          {
            id: 'cr-out-r',
            x: 10.2 + rng() * 1.4,
            y: 2.0 + jitter(0.8),
            w: 4.2,
            h: 0.8,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#6b5e68',
          },
        ],
        anchors: [],
        hazards: [],
        skyColor: '#252833',
        fogColor: '#3d4554',
        accentColor: MECH_DEFINITIONS.phantom.color,
      },
      bots: [
        { x: flip * 0.5, y: 1.8, archetypeId: bot1Arch.id, policy: 'hunter', name: bot1Arch.name },
        { x: flip * 3.8, y: 1.8, archetypeId: bot2Arch.id, policy: 'brawler', name: bot2Arch.name },
      ],
    };
  }

  if (targetMech === 'thunderbolt') {
    const startX = flip * (-7.2 + jitter(1.0));
    const foeX = flip * (2.8 + jitter(1.4));
    return {
      waveIndex,
      targetMech,
      scenarioName: 'Storm-Arc Rush',
      instruction:
        'Close the gap across the stone runway! Chain THUNDERBOLT (Dash → Slide) into the enemy squad and shock them at the end of your slide!',
      hint: 'Dash → Slide into foes to zap them with the THUNDERBOLT pulse!',
      waypointX: foeX,
      waypointY: 1.6,
      paceScale,
      arena: {
        id: 'crucible',
        name: 'Mech Crucible · Thunderbolt',
        subtitle: 'Procedural Arc Rush',
        description: 'Blitz opponents with THUNDERBOLT.',
        blastBounds: { left: -21, right: 21, top: 18, bottom: -10.5 },
        spawnPoints: [{ x: startX, y: 1.5 }],
        platforms: [
          {
            id: 'cr-runway',
            x: 0,
            y: 0,
            w: 19.0 + rng() * 3.0,
            h: 1.3,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#575063',
          },
          {
            id: 'cr-arch-opt',
            x: flip * -1.2,
            y: 2.55,
            w: 2.6,
            h: 1.2,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: false,
            color: '#6b5e68',
          },
          {
            id: 'cr-crate',
            x: foeX - flip * 1.4,
            y: 1.3,
            w: 1.3,
            h: 1.3,
            kind: 'destructible',
            hp: 25,
            maxHp: 25,
            broken: false,
            respawnTimer: 0,
            grappleable: true,
            ledgeGrabbable: false,
            color: '#c48a47',
          },
        ],
        anchors: [],
        hazards: [],
        skyColor: '#252833',
        fogColor: '#3d4554',
        accentColor: MECH_DEFINITIONS.thunderbolt.color,
      },
      bots: [
        { x: foeX, y: 1.6, archetypeId: bot1Arch.id, policy: 'brawler', name: bot1Arch.name },
        { x: foeX + flip * 3.2, y: 1.6, archetypeId: bot2Arch.id, policy: 'acrobat', name: bot2Arch.name },
      ],
    };
  }

  if (targetMech === 'spider') {
    const startX = flip * (-9.5 + jitter(1.0));
    const wallX = flip * (-5.2 + jitter(0.8));
    const foeX = flip * (5.8 + jitter(1.2));
    return {
      waveIndex,
      targetMech,
      scenarioName: 'Cliff Wall Ambush',
      instruction:
        'A chasm blocks your route. Fire your Grappling Hook onto the tall stone tower, Wall Jump to ignite SPIDER, and launch across to strike!',
      hint: 'Hook the tower wall → Jump off wall (SPIDER) → Strike the enemy on the far ledge!',
      waypointX: wallX - flip * 0.9,
      waypointY: 4.5,
      paceScale,
      arena: {
        id: 'crucible',
        name: 'Mech Crucible · Spider',
        subtitle: 'Procedural Wall Redirection',
        description: 'Hook and wall-jump with SPIDER.',
        blastBounds: { left: -21, right: 21, top: 18, bottom: -10.5 },
        spawnPoints: [{ x: startX, y: 1.8 }],
        platforms: [
          {
            id: 'cr-left',
            x: startX,
            y: 0.4,
            w: 5.5,
            h: 1.2,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#575063',
          },
          {
            id: 'cr-tower',
            x: wallX,
            y: 4.0,
            w: 1.3,
            h: 7.0,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#736570',
          },
          {
            id: 'cr-far',
            x: foeX,
            y: 1.6 + jitter(0.8),
            w: 8.0,
            h: 1.3,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#575063',
          },
        ],
        anchors: [],
        hazards: [],
        skyColor: '#252833',
        fogColor: '#3d4554',
        accentColor: MECH_DEFINITIONS.spider.color,
      },
      bots: [
        { x: foeX, y: 3.4, archetypeId: bot1Arch.id, policy: 'hunter', name: bot1Arch.name },
        { x: foeX + flip * 2.2, y: 3.4, archetypeId: bot2Arch.id, policy: 'opportunist', name: bot2Arch.name },
      ],
    };
  }

  if (targetMech === 'comet') {
    const startX = flip * (-9.5 + jitter(1.0));
    const beamX = flip * (-1.0 + jitter(1.4));
    const foeX = flip * (7.2 + jitter(1.0));
    return {
      waveIndex,
      targetMech,
      scenarioName: 'Pendulum Comet',
      instruction:
        'Cross the wide abyss! Hook the overhead stone beam, build rope Swing speed, Dive into COMET, and crash into the foes below!',
      hint: 'Hook overhead beam → Swing fast → Dive into COMET onto the rivals!',
      waypointX: beamX,
      waypointY: 7.4,
      paceScale,
      arena: {
        id: 'crucible',
        name: 'Mech Crucible · Comet',
        subtitle: 'Procedural Swing-Dive Strike',
        description: 'Build swing momentum into a COMET slam.',
        blastBounds: { left: -21, right: 21, top: 18, bottom: -10.5 },
        spawnPoints: [{ x: startX, y: 4.0 }],
        platforms: [
          {
            id: 'cr-launch',
            x: startX,
            y: 2.5,
            w: 4.8,
            h: 1.2,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#575063',
          },
          {
            id: 'cr-beam',
            x: beamX,
            y: 8.2 + jitter(0.6),
            w: 2.8,
            h: 0.75,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: false,
            color: '#7d5a42',
          },
          {
            id: 'cr-land',
            x: foeX,
            y: 0.2 + jitter(0.6),
            w: 9.2,
            h: 1.4,
            kind: 'solid',
            grappleable: true,
            ledgeGrabbable: true,
            color: '#575063',
          },
        ],
        anchors: [],
        hazards: [],
        skyColor: '#252833',
        fogColor: '#3d4554',
        accentColor: MECH_DEFINITIONS.comet.color,
      },
      bots: [
        { x: foeX - flip * 1.4, y: 2.2, archetypeId: bot1Arch.id, policy: 'brawler', name: bot1Arch.name },
        { x: foeX + flip * 1.8, y: 2.2, archetypeId: bot2Arch.id, policy: 'acrobat', name: bot2Arch.name },
      ],
    };
  }

  // BULLDOZER (Run -> Slide -> Dash)
  const startX = flip * (-7.8 + jitter(0.8));
  const foeX = flip * (2.6 + jitter(1.2));
  return {
    waveIndex,
    targetMech: 'bulldozer',
    scenarioName: 'Iron Ram Charge',
    instruction:
      'Break through the enemy front line! Sprint (Run), drop into a Slide, then snap into a Dash to unleash BULLDOZER and plow through them!',
    hint: 'Run → Slide → Dash straight through advancing bots to ram them back!',
    waypointX: foeX,
    waypointY: 1.8,
    paceScale,
    arena: {
      id: 'crucible',
      name: 'Mech Crucible · Bulldozer',
      subtitle: 'Procedural Heavy Ram',
      description: 'Smash formations with BULLDOZER.',
      blastBounds: { left: -21, right: 21, top: 18, bottom: -10.5 },
      spawnPoints: [{ x: startX, y: 1.6 }],
      platforms: [
        {
          id: 'cr-arena',
          x: 0,
          y: 0,
          w: 18.5 + rng() * 2.5,
          h: 1.4,
          kind: 'solid',
          grappleable: true,
          ledgeGrabbable: true,
          color: '#575063',
        },
        {
          id: 'cr-loft',
          x: flip * 3.0,
          y: 3.8 + jitter(0.6),
          w: 4.5,
          h: 0.48,
          kind: 'passthrough',
          grappleable: true,
          ledgeGrabbable: true,
          color: '#8c6b4d',
        },
      ],
      anchors: [],
      hazards: [],
      skyColor: '#252833',
      fogColor: '#3d4554',
      accentColor: MECH_DEFINITIONS.bulldozer.color,
    },
    bots: [
      { x: foeX, y: 1.8, archetypeId: bot1Arch.id, policy: 'brawler', name: bot1Arch.name },
      { x: foeX + flip * 2.8, y: 1.8, archetypeId: bot2Arch.id, policy: 'hunter', name: bot2Arch.name },
    ],
  };
}

export function createTutorialRunner(
  mode: TutorialMode = 'basics',
  handedness: Handedness = 'right',
  seed = Date.now(),
  startLevelIndex = 0,
  completedLevelIds: string[] = []
): TutorialRunner {
  const mechOrder = buildShuffledMechOrder(seed);

  if (mode === 'crucible') {
    const first = generateProceduralCrucibleScenario(0, seed, mechOrder[0]);
    return {
      mode,
      handedness,
      stepIndex: 0,
      totalSteps: mechOrder.length,
      completed: false,
      flags: {},
      academyProgress: createEmptyAcademyProgress(),
      completedLevelIds: [...completedLevelIds],
      failuresOnLevel: 0,
      reteachMode: false,
      reroutedFrom: null,
      holdRunTime: 0,
      mechUseWindow: 0,
      seed,
      mechOrder,
      currentScenario: first,
      currentAcademySetup: null,
    };
  }

  const clampedIdx = Math.max(0, Math.min(ACADEMY_LEVELS.length - 1, startLevelIndex));
  const level = ACADEMY_LEVELS[clampedIdx];
  const setup = buildAcademyScenarioSetup(level, seed, false);

  return {
    mode: 'basics',
    handedness,
    stepIndex: clampedIdx,
    totalSteps: ACADEMY_LEVELS.length,
    completed: false,
    flags: {},
    academyProgress: createEmptyAcademyProgress(),
    completedLevelIds: [...completedLevelIds],
    failuresOnLevel: 0,
    reteachMode: false,
    reroutedFrom: null,
    holdRunTime: 0,
    mechUseWindow: 0,
    seed,
    mechOrder,
    currentScenario: null,
    currentAcademySetup: setup,
  };
}

export function jumpRunnerToLevel(
  runner: TutorialRunner,
  targetLevelIndex: number
): ActiveScenarioSetup | null {
  if (runner.mode !== 'basics') return null;
  const idx = Math.max(0, Math.min(ACADEMY_LEVELS.length - 1, targetLevelIndex));
  runner.stepIndex = idx;
  runner.completed = false;
  runner.flags = {};
  runner.academyProgress = createEmptyAcademyProgress();
  runner.failuresOnLevel = 0;
  runner.reteachMode = false;
  runner.reroutedFrom = null;
  const level = ACADEMY_LEVELS[idx];
  const setup = buildAcademyScenarioSetup(level, runner.seed, false);
  runner.currentAcademySetup = setup;
  return setup;
}

export function updateTutorialRunner(
  runner: TutorialRunner,
  sim: SimulationState,
  player: FighterState | undefined,
  events: SimEvent[],
  dt: number,
  pullHeld: boolean
): {
  snapshot: TutorialStepSnapshot;
  stepAdvanced: boolean;
  rerouted: boolean;
  justCompleted: boolean;
  nextCrucibleScenario?: CrucibleScenario;
  nextAcademySetup?: ActiveScenarioSetup;
} {
  if (runner.completed || !player) {
    return {
      snapshot: getTutorialSnapshot(runner),
      stepAdvanced: false,
      rerouted: false,
      justCompleted: false,
    };
  }

  const pid = player.id;

  // =========================================================================
  // CRUCIBLE MODE (5 Randomized Live-Combat Mech Scenarios)
  // =========================================================================
  if (runner.mode === 'crucible' && runner.currentScenario) {
    const targetMech = runner.currentScenario.targetMech;
    runner.mechUseWindow = Math.max(0, runner.mechUseWindow - dt);

    if (player.activeMech?.id === targetMech) {
      runner.flags.mech = true;
      runner.mechUseWindow = Math.max(runner.mechUseWindow, 2.2);
    }

    let playerFell = false;
    for (const ev of events) {
      if (ev.fighterId === pid && ev.type === 'tutorial_fall') {
        playerFell = true;
      }
      if (ev.fighterId === pid && ev.type === 'mech_trigger' && ev.mechId === targetMech) {
        runner.flags.mech = true;
        runner.mechUseWindow = 2.6;
      }
      if (
        (ev.type === 'attack_hit' || ev.type === 'mech_pulse') &&
        ev.fighterId === pid &&
        (ev.mechId === targetMech || runner.mechUseWindow > 0 || runner.flags.mech)
      ) {
        if (ev.type === 'attack_hit' || sim.fighters.some((f) => f.id !== pid && f.hitFlashTimer > 0)) {
          runner.flags.combat = true;
        }
      }
      if (ev.type === 'ko' && ev.fighterId !== pid && (runner.flags.mech || runner.mechUseWindow > 0)) {
        runner.flags.combat = true;
      }
    }

    if (playerFell) {
      runner.failuresOnLevel += 1;
      if (runner.failuresOnLevel >= 2 && !runner.reteachMode) {
        runner.reteachMode = true;
        runner.currentScenario = {
          ...runner.currentScenario,
          paceScale: Math.max(0.74, Number((runner.currentScenario.paceScale - 0.1).toFixed(2))),
        };
      }
    }

    if (targetMech === 'phantom' && player.intangibleToPlayers) {
      const nearEnemy = sim.fighters.some(
        (f) => f.id !== pid && f.alive && Math.hypot(f.x - player.x, f.y - player.y) < 2.2
      );
      if (nearEnemy) {
        runner.flags.combat = true;
      }
    }

    const done = Boolean(runner.flags.mech && runner.flags.combat);
    let stepAdvanced = false;
    let justCompleted = false;
    let nextCrucibleScenario: CrucibleScenario | undefined;

    if (done) {
      if (runner.stepIndex < runner.totalSteps - 1) {
        runner.stepIndex += 1;
        runner.flags = {};
        runner.mechUseWindow = 0;
        runner.failuresOnLevel = 0;
        runner.reteachMode = false;
        const nextMech = runner.mechOrder[runner.stepIndex];
        const nextScen = generateProceduralCrucibleScenario(
          runner.stepIndex,
          runner.seed,
          nextMech
        );
        runner.currentScenario = nextScen;
        nextCrucibleScenario = nextScen;
        stepAdvanced = true;
      } else {
        runner.completed = true;
        justCompleted = true;
      }
    }

    return {
      snapshot: getTutorialSnapshot(runner),
      stepAdvanced,
      rerouted: false,
      justCompleted,
      nextCrucibleScenario,
    };
  }

  // =========================================================================
  // MASTERY ACADEMY MODE (28 Interleaved Levels + Adaptive Failure Rerouting)
  // =========================================================================
  const level = ACADEMY_LEVELS[Math.min(runner.stepIndex, ACADEMY_LEVELS.length - 1)];

  for (const k of Object.keys(runner.academyProgress.timers)) {
    runner.academyProgress.timers[k] = Math.max(0, runner.academyProgress.timers[k] - dt);
  }

  let failedAttempt = false;
  for (const ev of events) {
    if (ev.fighterId === pid && ev.type === 'tutorial_fall') {
      failedAttempt = true;
    }
  }

  // Also count failing the survival/no-KO rule in Movement V if the player gets knocked away offstage or hitstunned repeatedly? No—tutorial_fall already triggers cleanly whenever the player falls off or gets knocked into blast bounds!
  if (failedAttempt) {
    runner.failuresOnLevel += 1;
    // Reset survival streak on fall so survival drills stay honest
    runner.academyProgress.survivedSeconds = 0;

    if (runner.failuresOnLevel >= level.failLimit) {
      // Trigger Failure Reroute back to prerequisite skill!
      const prereqIdx = ACADEMY_LEVELS.findIndex((l) => l.id === level.rerouteToId);
      const targetIdx = prereqIdx >= 0 ? prereqIdx : Math.max(0, runner.stepIndex - 1);
      const prereqLevel = ACADEMY_LEVELS[targetIdx];

      runner.reroutedFrom = {
        levelIndex: runner.stepIndex,
        levelNumber: level.number,
        title: level.shortTitle,
        reason: level.rerouteReason,
      };
      runner.stepIndex = targetIdx;
      runner.failuresOnLevel = 0;
      runner.reteachMode = true;
      runner.flags = {};
      runner.academyProgress = createEmptyAcademyProgress();

      const reteachSetup = buildAcademyScenarioSetup(prereqLevel, runner.seed, true);
      runner.currentAcademySetup = reteachSetup;

      return {
        snapshot: getTutorialSnapshot(runner),
        stepAdvanced: false,
        rerouted: true,
        justCompleted: false,
        nextAcademySetup: reteachSetup,
      };
    }
  }

  level.evaluate({
    sim,
    player,
    events,
    dt,
    pullHeld,
    progress: runner.academyProgress,
  });

  const allDone = level.items.every((item) => Boolean(runner.academyProgress.flags[item.id]));
  let stepAdvanced = false;
  let justCompleted = false;
  let nextAcademySetup: ActiveScenarioSetup | undefined;

  if (allDone) {
    if (!runner.completedLevelIds.includes(level.id)) {
      runner.completedLevelIds.push(level.id);
    }

    if (runner.reroutedFrom && runner.stepIndex !== runner.reroutedFrom.levelIndex) {
      // Completed the prerequisite reteach drill -> return straight back to the level they struggled on!
      const returnIdx = runner.reroutedFrom.levelIndex;
      runner.stepIndex = returnIdx;
      runner.reroutedFrom = null;
      runner.reteachMode = false;
      runner.failuresOnLevel = 0;
      runner.flags = {};
      runner.academyProgress = createEmptyAcademyProgress();
      const returnLevel = ACADEMY_LEVELS[returnIdx];
      const setup = buildAcademyScenarioSetup(returnLevel, runner.seed, false);
      runner.currentAcademySetup = setup;
      nextAcademySetup = setup;
      stepAdvanced = true;
    } else if (runner.stepIndex < ACADEMY_LEVELS.length - 1) {
      runner.stepIndex += 1;
      runner.reroutedFrom = null;
      runner.reteachMode = false;
      runner.failuresOnLevel = 0;
      runner.flags = {};
      runner.academyProgress = createEmptyAcademyProgress();
      const nextLevel = ACADEMY_LEVELS[runner.stepIndex];
      const setup = buildAcademyScenarioSetup(nextLevel, runner.seed, false);
      runner.currentAcademySetup = setup;
      nextAcademySetup = setup;
      stepAdvanced = true;
    } else {
      runner.completed = true;
      justCompleted = true;
    }
  }

  return {
    snapshot: getTutorialSnapshot(runner),
    stepAdvanced,
    rerouted: false,
    justCompleted,
    nextAcademySetup,
  };
}

export function getTutorialSnapshot(runner: TutorialRunner): TutorialStepSnapshot {
  if (runner.mode === 'crucible' && runner.currentScenario) {
    const sc = runner.currentScenario;
    const def = MECH_DEFINITIONS[sc.targetMech];
    return {
      mode: 'crucible',
      stepIndex: runner.stepIndex,
      totalSteps: runner.totalSteps,
      levelNumber: runner.stepIndex + 1,
      totalLevels: runner.totalSteps,
      paceLabel: `${sc.paceScale.toFixed(2)}× ${sc.paceScale < 0.94 ? 'Measured' : 'Live'}`,
      paceScale: sc.paceScale,
      title: `${def.name} · ${sc.scenarioName}`,
      instruction: sc.instruction,
      hint: sc.hint,
      targetMech: sc.targetMech,
      scenarioName: sc.scenarioName,
      failuresOnLevel: runner.failuresOnLevel,
      maxFailsBeforeReroute: 2,
      reteachMode: runner.reteachMode,
      reroutedFrom: null,
      items: [
        {
          id: 'mech',
          label: `Trigger ${def.name} (${def.sequence.map((s) => s.replace('_', ' ')).join(' → ')})`,
          done: runner.completed || Boolean(runner.flags.mech),
        },
        {
          id: 'combat',
          label:
            sc.targetMech === 'phantom'
              ? 'Phase past or strike an active rival!'
              : 'Strike / launch an active rival with it!',
          done: runner.completed || Boolean(runner.flags.combat),
        },
      ],
      waypointX: sc.waypointX,
      waypointY: sc.waypointY,
      completed: runner.completed,
    };
  }

  const level = ACADEMY_LEVELS[Math.min(runner.stepIndex, ACADEMY_LEVELS.length - 1)];
  const activePace = runner.currentAcademySetup?.paceScale ?? level.paceScale;

  return {
    mode: 'basics',
    stepIndex: runner.stepIndex,
    totalSteps: ACADEMY_LEVELS.length,
    levelNumber: level.number,
    totalLevels: ACADEMY_LEVELS.length,
    levelId: level.id,
    tier: level.tier,
    category: level.category,
    paceScale: activePace,
    paceLabel: runner.reteachMode
      ? `${activePace.toFixed(2)}× Reteach`
      : level.paceLabel,
    title: level.title,
    instruction: runner.reteachMode ? level.reteachInstruction : level.instruction,
    hint: level.getHint(runner.handedness),
    items: formatAcademyItems(
      level,
      runner.handedness,
      runner.academyProgress,
      runner.completed
    ),
    waypointX: level.waypointX,
    waypointY: level.waypointY,
    targetZone: level.targetZone ?? null,
    targetMech: level.targetMech,
    failuresOnLevel: runner.failuresOnLevel,
    maxFailsBeforeReroute: level.failLimit,
    reteachMode: runner.reteachMode,
    reroutedFrom: runner.reroutedFrom,
    completedLevelIds: [...runner.completedLevelIds],
    completed: runner.completed,
  };
}

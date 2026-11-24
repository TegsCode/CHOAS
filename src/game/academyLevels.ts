import { FIGHTER_ARCHETYPES, MECH_DEFINITIONS } from './constants';
import {
  ArenaConfig,
  FighterState,
  Handedness,
  MechId,
  SimEvent,
  SimulationState,
  TutorialBotBehavior,
  TutorialCheckItem,
  TutorialTier,
} from './types';
import { getControlBindings } from './constants';

export interface AcademyBotSpec {
  x: number;
  y: number;
  archetypeId: string;
  policy: FighterState['aiPolicy'];
  name: string;
  initialDamage?: number;
}

export interface AcademyZoneTarget {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface AcademyProgressState {
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  timers: Record<string, number>;
  recentHitTimer: number;
  survivedSeconds: number;
  tookDamageInStep: boolean;
  mechsSeen: string[];
}

export interface AcademyLevelDef {
  id: string;
  number: number;
  category: string;
  tier: TutorialTier;
  title: string;
  shortTitle: string;
  paceScale: number;
  paceLabel: string;
  botBehavior: TutorialBotBehavior;
  botAggression: number;
  botHomeX: number;
  playerStartDamage?: number;
  failLimit: number;
  rerouteToId: string;
  rerouteReason: string;
  instruction: string;
  reteachInstruction: string;
  getHint: (h: Handedness) => string;
  waypointX: number;
  waypointY: number;
  targetZone?: AcademyZoneTarget;
  targetMech?: MechId;
  buildArena: (seed: number) => ArenaConfig;
  buildBots: (seed: number) => AcademyBotSpec[];
  items: Array<{
    id: string;
    label: (h: Handedness) => string;
  }>;
  evaluate: (
    ctx: {
      sim: SimulationState;
      player: FighterState;
      events: SimEvent[];
      dt: number;
      pullHeld: boolean;
      progress: AcademyProgressState;
    }
  ) => void;
}

function makeArenaBase(
  idSuffix: string,
  name: string,
  subtitle: string,
  spawnX: number,
  spawnY: number,
  platforms: ArenaConfig['platforms'],
  anchors: ArenaConfig['anchors'] = [],
  hazards: ArenaConfig['hazards'] = []
): ArenaConfig {
  return {
    id: 'tutorial',
    name,
    subtitle: `${idSuffix} · ${subtitle}`,
    description: subtitle,
    blastBounds: { left: -21, right: 21, top: 18, bottom: -10.5 },
    spawnPoints: [{ x: spawnX, y: spawnY }],
    platforms,
    anchors,
    hazards,
    skyColor: '#252833',
    fogColor: '#3d4554',
    accentColor: '#e8a848',
  };
}

function solid(id: string, x: number, y: number, w: number, h: number, color = '#575063'): ArenaConfig['platforms'][number] {
  return { id, x, y, w, h, kind: 'solid', grappleable: true, ledgeGrabbable: true, color };
}

function pass(id: string, x: number, y: number, w: number, h = 0.45, color = '#8c6b4d'): ArenaConfig['platforms'][number] {
  return { id, x, y, w, h, kind: 'passthrough', grappleable: true, ledgeGrabbable: true, color };
}

function crate(id: string, x: number, y: number, hp = 25): ArenaConfig['platforms'][number] {
  return {
    id,
    x,
    y,
    w: 1.3,
    h: 1.3,
    kind: 'destructible',
    hp,
    maxHp: hp,
    broken: false,
    respawnTimer: 0,
    grappleable: true,
    ledgeGrabbable: false,
    color: '#c48a47',
  };
}

function barrel(id: string, x: number, y: number): ArenaConfig['hazards'][number] {
  return {
    id,
    kind: 'barrel',
    x,
    y,
    w: 1.0,
    h: 1.2,
    baseY: y,
    active: true,
    warningTimer: 0,
    cycleTimer: 0,
    exploded: false,
    respawnTimer: 0,
    knockback: 23,
    lethal: false,
  };
}

export const ACADEMY_LEVELS: AcademyLevelDef[] = [
  // =========================================================================
  // 1. MOVEMENT I — Ground Footing & Precision Stops
  // =========================================================================
  {
    id: 'mov-1',
    number: 1,
    category: 'Movement I',
    tier: 'beginner',
    title: 'Movement I · Ground Footing & Stopping',
    shortTitle: 'Movement I: Footing',
    paceScale: 0.74,
    paceLabel: '0.74× Calm',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'mov-1',
    rerouteReason: 'Take a calmer second look at braking before platform edges.',
    instruction:
      'Learn when to move left & right and when to release keys to brake cleanly. Sprint onto the right chalk marker and come to a full stop, then return to the left marker without slipping off.',
    reteachInstruction:
      'Reteach Mode (Extra Calm): Tap direction lightly as you near the amber chalk box so you stop cleanly inside it.',
    getHint: (h) => `${getControlBindings(h).move} to Move · Release keys early to brake before the cliff edge`,
    waypointX: 5.8,
    waypointY: 1.7,
    targetZone: { x: 5.8, y: 1.35, w: 3.4, h: 1.3, label: 'STOP ZONE' },
    buildArena: () =>
      makeArenaBase(
        'LV 01',
        'Courtyard Pier',
        'Precision movement & edge braking',
        -6.0,
        1.4,
        [solid('m1-deck', 0, 0, 18.0, 1.4)]
      ),
    buildBots: () => [],
    items: [
      { id: 'stop_right', label: () => 'Sprint right and come to a clean stop at the right marker' },
      { id: 'stop_left', label: () => 'Reverse left and brake cleanly on the left side' },
    ],
    evaluate: ({ player, progress }) => {
      if (player.grounded && Math.abs(player.vx) < 1.35 && player.x >= 4.0 && player.x <= 8.0) {
        progress.flags.stop_right = true;
      }
      if (
        progress.flags.stop_right &&
        player.grounded &&
        Math.abs(player.vx) < 1.35 &&
        player.x <= -3.5 &&
        player.x >= -8.0
      ) {
        progress.flags.stop_left = true;
      }
    },
  },

  // =========================================================================
  // 2. JUMPING I — Short Hop vs Full Hold Jump
  // =========================================================================
  {
    id: 'jmp-1',
    number: 2,
    category: 'Jumping I',
    tier: 'beginner',
    title: 'Jumping I · Tap Hop vs Held Jump',
    shortTitle: 'Jumping I: Height Control',
    paceScale: 0.76,
    paceLabel: '0.76× Calm',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'mov-1',
    rerouteReason: 'Let us tighten up basic ground positioning before jumping ledges.',
    instruction:
      'Tap Jump briefly for a low hop onto the first step, then hold Jump down longer to clear the high stone terrace.',
    reteachInstruction:
      'Reteach Mode: Walk near the terrace edge first, then hold Jump all the way to the top of your arc.',
    getHint: (h) => `${getControlBindings(h).jump} tap = short hop · Hold ${getControlBindings(h).jump} = full height`,
    waypointX: 6.5,
    waypointY: 4.8,
    targetZone: { x: 6.5, y: 4.5, w: 4.2, h: 1.4, label: 'HIGH TERRACE' },
    buildArena: () =>
      makeArenaBase(
        'LV 02',
        'Stepped Ruins',
        'Variable jump height control',
        -6.8,
        1.4,
        [
          solid('j1-base', -5.5, 0, 9.0, 1.4),
          solid('j1-mid', 0.4, 1.5, 4.0, 0.8, '#6b5e68'),
          solid('j1-high', 6.5, 3.2, 5.2, 1.0),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'step_mid', label: () => 'Hop onto the middle stone step' },
      { id: 'reach_high', label: () => 'Hold Jump cleanly onto the upper terrace' },
    ],
    evaluate: ({ player, progress }) => {
      if (player.grounded && player.x >= -1.8 && player.x <= 2.6 && player.y >= 1.6) {
        progress.flags.step_mid = true;
      }
      if (player.grounded && player.x >= 3.8 && player.y >= 3.3) {
        progress.flags.reach_high = true;
      }
    },
  },

  // =========================================================================
  // 3. MOVEMENT II — Air Drift & Mid-Jump Steering (Interleaved after Jumping I!)
  // =========================================================================
  {
    id: 'mov-2',
    number: 3,
    category: 'Movement II',
    tier: 'beginner',
    title: 'Movement II · Air Drift & Mid-Jump Steering',
    shortTitle: 'Movement II: Air Drift',
    paceScale: 0.78,
    paceLabel: '0.78× Calm',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'jmp-1',
    rerouteReason: 'Revisit jump height control so you have enough altitude to steer midair.',
    instruction:
      'Practice moving WHILE jumping: leap forward off the main deck, reverse your horizontal direction midair, and steer cleanly onto the tucked upper loft behind you.',
    reteachInstruction:
      'Reteach Mode: Jump right past the shelf edge first, then hold Left in midair to curve cleanly back onto the wooden loft.',
    getHint: (h) => `Jump forward, then reverse ${getControlBindings(h).move} midair to hook onto the upper shelf`,
    waypointX: -3.2,
    waypointY: 4.2,
    targetZone: { x: -3.2, y: 3.9, w: 4.0, h: 1.3, label: 'TUCKED LOFT' },
    buildArena: () =>
      makeArenaBase(
        'LV 03',
        'Overhang Loft',
        'Airborne directional steering',
        -6.5,
        1.4,
        [
          solid('m2-base', -3.0, 0, 12.0, 1.4),
          pass('m2-loft', -3.2, 3.0, 4.4, 0.45),
          solid('m2-pillar', 1.6, 2.3, 1.1, 3.2, '#6b5e68'),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'midair_reverse', label: () => 'Reverse horizontal direction mid-jump' },
      { id: 'land_loft', label: () => 'Steer onto the tucked upper wooden loft' },
    ],
    evaluate: ({ player, progress }) => {
      if (!player.grounded) {
        if (player.vx > 2.5) progress.flags.saw_pos_vx = true;
        if (progress.flags.saw_pos_vx && player.vx < -1.8) {
          progress.flags.midair_reverse = true;
        }
      }
      if (player.grounded && player.y >= 2.8 && player.x >= -5.6 && player.x <= -0.8) {
        progress.flags.land_loft = true;
      }
    },
  },

  // =========================================================================
  // 4. JUMPING II — Saving Your Double Jump Across Gaps
  // =========================================================================
  {
    id: 'jmp-2',
    number: 4,
    category: 'Jumping II',
    tier: 'beginner',
    title: 'Jumping II · Patience & Double-Jump Arcs',
    shortTitle: 'Jumping II: Double Jump',
    paceScale: 0.78,
    paceLabel: '0.78× Calm',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'mov-2',
    rerouteReason: 'Sharpen your mid-jump Air Drift so you clear wide gaps cleanly.',
    instruction:
      'Do not panic-mash both jumps at once! Leap across the chasm, glide past the center marker on your first jump, and save your Double Jump for the climb onto the far cliff.',
    reteachInstruction:
      'Reteach Mode: Wait until you start descending near the middle of the pit before pressing Jump a second time.',
    getHint: (h) => `First ${getControlBindings(h).jump} at the ledge → wait until mid-pit → second ${getControlBindings(h).jump}`,
    waypointX: 7.2,
    waypointY: 2.6,
    targetZone: { x: 7.2, y: 2.3, w: 4.8, h: 1.4, label: 'FAR CLIFF' },
    buildArena: () =>
      makeArenaBase(
        'LV 04',
        'Twin Chasm',
        'Saving Double Jump for recovery',
        -7.8,
        1.4,
        [
          solid('j2-left', -7.2, 0, 5.4, 1.4),
          solid('j2-right', 7.2, 1.0, 5.6, 1.4),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'double_jump_mid', label: () => 'Spend Double Jump past the center chasm (x > -0.5)' },
      { id: 'far_land', label: () => 'Land safely on the far stone cliff' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'double_jump' && ev.x > -0.5) {
          progress.flags.double_jump_mid = true;
        }
      }
      if (player.grounded && player.x >= 4.4 && progress.flags.double_jump_mid) {
        progress.flags.far_land = true;
      }
    },
  },

  // =========================================================================
  // 5. COMBAT I — Approach Spacing & Clean Strikes
  // =========================================================================
  {
    id: 'cbt-1',
    number: 5,
    category: 'Combat I',
    tier: 'beginner',
    title: 'Combat I · Weapon Reach & Clean Strikes',
    shortTitle: 'Combat I: Spacing',
    paceScale: 0.80,
    paceLabel: '0.80× Calm',
    botBehavior: 'dummy',
    botAggression: 0,
    botHomeX: 4.5,
    failLimit: 2,
    rerouteToId: 'mov-1',
    rerouteReason: 'Practice stopping at exact spacing before committing to strikes.',
    instruction:
      'Approach the calm Sparring Puppet and stop just inside weapon range—avoid running right past it—then land 2 clean Strikes.',
    reteachInstruction:
      'Reteach Mode: Stop ~1.5 steps from the puppet so your spear/blade tip hits right on target.',
    getHint: (h) => `${getControlBindings(h).move} to step into range · ${getControlBindings(h).attack} to Strike (2 hits)`,
    waypointX: 4.5,
    waypointY: 2.1,
    buildArena: () =>
      makeArenaBase(
        'LV 05',
        'Sparring Deck',
        'Calm strike spacing drill',
        -4.8,
        1.4,
        [solid('c1-deck', 0, 0, 16.0, 1.4)]
      ),
    buildBots: () => [
      { x: 4.5, y: 1.4, archetypeId: 'titan', policy: 'brawler', name: 'Sparring Puppet' },
    ],
    items: [
      { id: 'hit_1', label: () => 'Land first spaced Strike on the Puppet' },
      { id: 'hit_2', label: () => 'Follow with a second clean Strike' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'attack_hit') {
          progress.counters.hits = (progress.counters.hits ?? 0) + 1;
          progress.flags.hit_1 = true;
          if (progress.counters.hits >= 2) progress.flags.hit_2 = true;
        }
      }
    },
  },

  // =========================================================================
  // 6. EVASION I — Low-Profile Slide & Momentum
  // =========================================================================
  {
    id: 'eva-1',
    number: 6,
    category: 'Evasion I',
    tier: 'beginner',
    title: 'Evasion I · Low-Profile Slide Corridor',
    shortTitle: 'Evasion I: Slide',
    paceScale: 0.80,
    paceLabel: '0.80× Calm',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'mov-1',
    rerouteReason: 'Build crisp ground speed before entering low slides.',
    instruction:
      'Two hanging stone lintels block upright runners. Gain running momentum and Slide cleanly underneath both arches onto the far pad.',
    reteachInstruction:
      'Reteach Mode: Hold forward toward the arch, then tap Slide one pace before entering it.',
    getHint: (h) => `Sprint forward + ${getControlBindings(h).slide} to Slide underneath the low arches`,
    waypointX: 7.5,
    waypointY: 1.7,
    targetZone: { x: 7.5, y: 1.35, w: 3.6, h: 1.3, label: 'EXIT PAD' },
    buildArena: () =>
      makeArenaBase(
        'LV 06',
        'Low Lintels',
        'Low-profile slide clearance',
        -8.0,
        1.4,
        [
          solid('e1-floor', 0, 0, 21.0, 1.4),
          solid('e1-arch1', -2.5, 3.0, 2.4, 2.2, '#6b5e68'),
          solid('e1-arch2', 3.0, 3.0, 2.4, 2.2, '#6b5e68'),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'slide_1', label: () => 'Slide cleanly beneath the first stone arch' },
      { id: 'reach_exit', label: () => 'Pass both arches and reach the far exit pad' },
    ],
    evaluate: ({ player, progress }) => {
      if (player.slideTimer > 0 && player.x > -4.0 && player.x < 4.5) {
        progress.flags.slide_1 = true;
      }
      if (progress.flags.slide_1 && player.grounded && player.x >= 5.7) {
        progress.flags.reach_exit = true;
      }
    },
  },

  // =========================================================================
  // 7. MOVEMENT III — Moving on Specific Objects (Conveyors & Crumbling Slabs)
  // =========================================================================
  {
    id: 'mov-3',
    number: 7,
    category: 'Movement III',
    tier: 'foundation',
    title: 'Movement III · Conveyors & Crumbling Slabs',
    shortTitle: 'Movement III: Terrain Objects',
    paceScale: 0.82,
    paceLabel: '0.82× Measured',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'jmp-2',
    rerouteReason: 'Brush up on Double-Jump pit recovery before crossing crumbling spans.',
    instruction:
      'Moving on specific terrain changes how your steps work: push against the headwind conveyor belt, cross the crumbling purple slab without lingering, then ride the tailwind conveyor to safety.',
    reteachInstruction:
      'Reteach Mode: Keep moving across the crumbling slab—never stop standing on crumbling stone!',
    getHint: (h) => `${getControlBindings(h).move} & ${getControlBindings(h).jump} — fight opposing belts, never pause on crumbling slabs`,
    waypointX: 9.2,
    waypointY: 2.0,
    targetZone: { x: 9.2, y: 1.65, w: 3.6, h: 1.3, label: 'SAFE PIER' },
    buildArena: () =>
      makeArenaBase(
        'LV 07',
        'Belt & Ruin Span',
        'Adapting movement to surface physics',
        -9.5,
        1.4,
        [
          solid('m3-start', -9.2, 0, 4.2, 1.4),
          {
            id: 'm3-conv-head',
            x: -3.5,
            y: 0.2,
            w: 5.0,
            h: 0.9,
            kind: 'conveyor',
            conveyorSpeed: -4.2,
            grappleable: true,
            ledgeGrabbable: true,
            color: '#463f47',
          },
          {
            id: 'm3-crumb',
            x: 1.4,
            y: 0.7,
            w: 3.0,
            h: 0.55,
            kind: 'crumbling',
            crumbleTimer: 0,
            broken: false,
            respawnTimer: 0,
            grappleable: true,
            ledgeGrabbable: true,
            color: '#8f6b7d',
          },
          {
            id: 'm3-conv-tail',
            x: 5.5,
            y: 0.4,
            w: 3.8,
            h: 0.9,
            kind: 'conveyor',
            conveyorSpeed: 4.5,
            grappleable: true,
            ledgeGrabbable: true,
            color: '#463f47',
          },
          solid('m3-end', 9.5, 0.5, 4.0, 1.3),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'cross_conv', label: () => 'Clear the opposing headwind conveyor belt' },
      { id: 'cross_crumb', label: () => 'Traverse the crumbling slab & reach the safe pier' },
    ],
    evaluate: ({ player, progress }) => {
      if (player.x >= -0.4 && player.y >= 0.4) progress.flags.cross_conv = true;
      if (progress.flags.cross_conv && player.grounded && player.x >= 7.5) {
        progress.flags.cross_crumb = true;
      }
    },
  },

  // =========================================================================
  // 8. DASH I — Burst Gap Clear & Edge Control
  // =========================================================================
  {
    id: 'dsh-1',
    number: 8,
    category: 'Dash I',
    tier: 'foundation',
    title: 'Dash I · Burst Gap Clear & Edge Brake',
    shortTitle: 'Dash I: Burst & Brake',
    paceScale: 0.84,
    paceLabel: '0.84× Measured',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'mov-1',
    rerouteReason: 'Revisit braking discipline so dashes do not launch you off ledges.',
    instruction:
      'Use an aerial Dash to stretch across a wide horizontal span where normal jumps fall short, then hold the opposite direction to brake on the short island.',
    reteachInstruction:
      'Reteach Mode: Jump forward from the edge, press Dash near apex, then tap Back on landing.',
    getHint: (h) => `${getControlBindings(h).jump} + ${getControlBindings(h).dash} in air · Tap opposite direction on landing`,
    waypointX: 6.8,
    waypointY: 2.0,
    targetZone: { x: 6.8, y: 1.5, w: 3.4, h: 1.4, label: 'SHORT PAD' },
    buildArena: () =>
      makeArenaBase(
        'LV 08',
        'Wind Gap',
        'Horizontal dash extension & stopping',
        -8.2,
        1.4,
        [
          solid('d1-start', -7.6, 0, 5.2, 1.4),
          solid('d1-island', 6.8, 0.2, 3.6, 1.3),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'dash_used', label: () => 'Fire a forward Dash across the gap' },
      { id: 'land_pad', label: () => 'Brake & settle cleanly on the short island pad' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'dash') progress.flags.dash_used = true;
      }
      if (
        progress.flags.dash_used &&
        player.grounded &&
        player.x >= 5.0 &&
        player.x <= 8.6 &&
        Math.abs(player.vx) < 2.0
      ) {
        progress.flags.land_pad = true;
      }
    },
  },

  // =========================================================================
  // 9. GRAPPLE I — Iron Hook Surface Latch
  // =========================================================================
  {
    id: 'grp-1',
    number: 9,
    category: 'Grapple I',
    tier: 'foundation',
    title: 'Grapple I · Iron Hook Surface Latch',
    shortTitle: 'Grapple I: Hook Latch',
    paceScale: 0.84,
    paceLabel: '0.84× Measured',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'jmp-1',
    rerouteReason: 'Practice basic jumps so you can aim cleanly from midair or ground.',
    instruction:
      'Your grappling hook latches onto almost ANY solid surface! Aim toward the overhead wooden beam or side tower face and stick 2 surface latches.',
    reteachInstruction:
      'Reteach Mode: Move your cursor over the amber target beam (or aim up-forward) and hold the Hook key.',
    getHint: (h) => `Aim pointer at a beam or wall + hold ${getControlBindings(h).grapple} to Latch Hook`,
    waypointX: 0,
    waypointY: 6.4,
    buildArena: () =>
      makeArenaBase(
        'LV 09',
        'Rigging Courtyard',
        'Surface-raycast grappling hook basics',
        -5.0,
        1.4,
        [
          solid('g1-floor', 0, 0, 18.0, 1.4),
          solid('g1-beam', 0, 6.4, 3.6, 0.75, '#7d5a42'),
          solid('g1-wall', 6.5, 4.0, 1.3, 6.2, '#6b5e68'),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'latch_beam', label: () => 'Hook onto the high overhead beam' },
      { id: 'latch_wall', label: () => 'Hook onto the vertical stone wall face' },
    ],
    evaluate: ({ player, progress }) => {
      if (player.grapple.active && player.grapple.phase === 'attached') {
        if (player.grapple.anchorY >= 5.2) progress.flags.latch_beam = true;
        if (player.grapple.anchorX >= 4.8 && player.grapple.anchorY < 7.2) {
          progress.flags.latch_wall = true;
        }
      }
    },
  },

  // =========================================================================
  // 10. DEFENSE I — Shield Guard & Perfect Parry
  // =========================================================================
  {
    id: 'def-1',
    number: 10,
    category: 'Defense I',
    tier: 'foundation',
    title: 'Defense I · Guard Posture & Perfect Parry',
    shortTitle: 'Defense I: Guard & Parry',
    paceScale: 0.85,
    paceLabel: '0.85× Measured',
    botBehavior: 'telegraphed_striker',
    botAggression: 0.25,
    botHomeX: 2.5,
    failLimit: 2,
    rerouteToId: 'cbt-1',
    rerouteReason: 'Revisit Spacing first so you can judge when an enemy strike is about to connect.',
    instruction:
      'Step near the slow Training Sentinel. Hold Guard to absorb one blow cleanly, then raise Guard right as its strike windup flashes to trigger a Perfect Parry!',
    reteachInstruction:
      'Reteach Mode: Wait within 2 paces of the sentinel; tap Guard the instant you see the bright windup spark.',
    getHint: (h) => `Hold ${getControlBindings(h).defend} to Block · Tap ${getControlBindings(h).defend} on flash to Perfect Parry`,
    waypointX: 2.5,
    waypointY: 2.1,
    buildArena: () =>
      makeArenaBase(
        'LV 10',
        'Shield Ward',
        'Telegraphed guard & parry timing',
        -4.5,
        1.4,
        [solid('df1-floor', 0, 0, 16.0, 1.4)]
      ),
    buildBots: () => [
      { x: 2.5, y: 1.4, archetypeId: 'rift', policy: 'brawler', name: 'Clockwork Sentinel' },
    ],
    items: [
      { id: 'block', label: () => 'Block or absorb 1 Sentinel attack' },
      { id: 'parry', label: () => 'Land 1 Perfect Parry reflection' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && (ev.type === 'guard_block' || ev.type === 'parry')) {
          progress.flags.block = true;
        }
        if (ev.fighterId === player.id && ev.type === 'parry') {
          progress.flags.parry = true;
        }
      }
    },
  },

  // =========================================================================
  // 11. GRAPPLE II — Pendulum Swing & Momentum Release
  // =========================================================================
  {
    id: 'grp-2',
    number: 11,
    category: 'Grapple II',
    tier: 'foundation',
    title: 'Grapple II · Pendulum Swing & Release',
    shortTitle: 'Grapple II: Rope Swing',
    paceScale: 0.86,
    paceLabel: '0.86× Measured',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'grp-1',
    rerouteReason: 'Lock down surface hook latching before chaining full pendulum swings.',
    instruction:
      'Leap toward the chasm, hook the high ceiling beam, pump left/right to build pendulum swing speed, and release at the upswing to soar onto the far platform.',
    reteachInstruction:
      'Reteach Mode: Keep holding Hook as you swing through the bottom arc, hold Right, then release Hook on the upswing!',
    getHint: (h) => `Hold ${getControlBindings(h).grapple} on the beam · Pump ${getControlBindings(h).move} · Release on upswing`,
    waypointX: 0,
    waypointY: 7.4,
    targetZone: { x: 8.6, y: 2.2, w: 4.5, h: 1.5, label: 'FAR CLIFF' },
    buildArena: () =>
      makeArenaBase(
        'LV 11',
        'Pendulum Gorge',
        'Rope arc momentum & release timing',
        -8.6,
        2.6,
        [
          solid('g2-left', -8.6, 1.2, 4.6, 1.3),
          solid('g2-beam', 0, 7.8, 3.0, 0.7, '#7d5a42'),
          solid('g2-right', 8.6, 0.9, 5.2, 1.4),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'swing_fast', label: () => 'Build fast pendulum rope swing momentum' },
      { id: 'swing_land', label: () => 'Release cleanly and land on the far cliff' },
    ],
    evaluate: ({ player, progress }) => {
      if (player.grapple.active && player.grapple.phase === 'attached' && player.grapple.swingSpeed >= 9.0) {
        progress.flags.swing_fast = true;
      }
      if (progress.flags.swing_fast && player.grounded && player.x >= 6.0) {
        progress.flags.swing_land = true;
      }
    },
  },

  // =========================================================================
  // 12. MOVEMENT IV — Wall Cling, Wall Jump & Ledge Discipline (Interleaved!)
  // =========================================================================
  {
    id: 'mov-4',
    number: 12,
    category: 'Movement IV',
    tier: 'foundation',
    title: 'Movement IV · Chimney Wall Jump & Ledge Climb',
    shortTitle: 'Movement IV: Wall & Ledge',
    paceScale: 0.87,
    paceLabel: '0.87× Measured',
    botBehavior: 'none',
    botAggression: 0,
    botHomeX: 0,
    failLimit: 2,
    rerouteToId: 'mov-2',
    rerouteReason: 'Revisit Air Drift so steering between opposite walls feels natural.',
    instruction:
      'Vertical walls are highways: slide gently down a shaft wall, kick off between opposite walls to climb the stone chimney, then snag and climb the upper balcony edge.',
    reteachInstruction:
      'Reteach Mode: Hold toward a wall to slow your fall, then tap Jump and steer toward the opposite wall.',
    getHint: (h) => `Push into wall + ${getControlBindings(h).jump} to Wall Jump up the chimney onto the high balcony`,
    waypointX: 5.5,
    waypointY: 6.6,
    targetZone: { x: 5.5, y: 6.2, w: 4.2, h: 1.4, label: 'UPPER BALCONY' },
    buildArena: () =>
      makeArenaBase(
        'LV 12',
        'Belltower Shaft',
        'Wall slide, wall jump & ledge grabs',
        -6.5,
        1.4,
        [
          solid('m4-floor', -4.0, 0, 9.0, 1.4),
          solid('m4-wall-l', -4.2, 4.3, 1.1, 6.2, '#6b5e68'),
          solid('m4-wall-r', 0.2, 3.6, 1.1, 5.4, '#6b5e68'),
          solid('m4-balc', 5.4, 5.0, 5.0, 1.1),
        ]
      ),
    buildBots: () => [],
    items: [
      { id: 'wj_2', label: () => 'Chain 2 alternating Wall Jumps up the chimney' },
      { id: 'reach_balc', label: () => 'Reach or ledge-climb onto the upper balcony' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'wall_jump') {
          progress.counters.wj = (progress.counters.wj ?? 0) + 1;
          if (progress.counters.wj >= 2) progress.flags.wj_2 = true;
        }
      }
      if (progress.flags.wj_2 && player.grounded && player.x >= 3.0 && player.y >= 5.2) {
        progress.flags.reach_balc = true;
      }
    },
  },

  // =========================================================================
  // 13. MECH I — PHANTOM (Dash -> Double Jump)
  // =========================================================================
  {
    id: 'mch-1',
    number: 13,
    category: 'Mech I · Phantom',
    tier: 'foundation',
    title: 'Mech I · PHANTOM (Dash → Double Jump)',
    shortTitle: 'Mech I: PHANTOM',
    paceScale: 0.88,
    paceLabel: '0.88× Measured',
    botBehavior: 'patrol_guard',
    botAggression: 0.35,
    botHomeX: 0,
    targetMech: 'phantom',
    failLimit: 2,
    rerouteToId: 'dsh-1',
    rerouteReason: 'Lock down Dash rhythm first so Dash → Double Jump flows smoothly.',
    instruction:
      'A Stone Warden guards the narrow bridge. Chain Dash directly into Double Jump to ignite PHANTOM, phase right through the warden without colliding, and claim the far perch!',
    reteachInstruction:
      'Reteach Mode: Press Dash toward the warden, then press Jump right before passing through.',
    getHint: (h) => `${getControlBindings(h).dash} → ${getControlBindings(h).jump} (midair) = PHANTOM body-phase`,
    waypointX: 7.5,
    waypointY: 2.0,
    targetZone: { x: 7.5, y: 1.5, w: 3.8, h: 1.4, label: 'SAFE PERCH' },
    buildArena: () =>
      makeArenaBase(
        'LV 13',
        'Warden Bridge',
        'Body-phase through blockers with PHANTOM',
        -7.2,
        1.4,
        [solid('ph-bridge', 0, 0, 19.0, 1.4)]
      ),
    buildBots: () => [
      { x: 0, y: 1.4, archetypeId: 'wraith', policy: 'brawler', name: 'Bridge Warden' },
    ],
    items: [
      { id: 'phantom_on', label: () => 'Activate PHANTOM (Dash → Double Jump)' },
      { id: 'slip_past', label: () => 'Phase past the Warden onto the far perch' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'mech_trigger' && ev.mechId === 'phantom') {
          progress.flags.phantom_on = true;
        }
      }
      if (player.activeMech?.id === 'phantom') progress.flags.phantom_on = true;
      if (progress.flags.phantom_on && player.grounded && player.x >= 5.2) {
        progress.flags.slip_past = true;
      }
    },
  },

  // =========================================================================
  // 14. MECH II — METEOR (Jump -> Dive)
  // =========================================================================
  {
    id: 'mch-2',
    number: 14,
    category: 'Mech II · Meteor',
    tier: 'foundation',
    title: 'Mech II · METEOR (Jump → Dive)',
    shortTitle: 'Mech II: METEOR',
    paceScale: 0.89,
    paceLabel: '0.89× Measured',
    botBehavior: 'dummy',
    botAggression: 0,
    botHomeX: 4.5,
    targetMech: 'meteor',
    failLimit: 2,
    rerouteToId: 'jmp-2',
    rerouteReason: 'Refine aerial jump timing before committing to Dive slams.',
    instruction:
      'Leap from the high scaffold, chain Jump into Dive to unleash METEOR, and smash the stacked supply crate + sentinel below with the landing shockwave!',
    reteachInstruction:
      'Reteach Mode: Jump forward above the crate/sentinel, then press Dive straight downward.',
    getHint: (h) => `${getControlBindings(h).jump} → ${getControlBindings(h).dive} above targets = METEOR shockwave`,
    waypointX: 4.2,
    waypointY: 2.0,
    buildArena: () =>
      makeArenaBase(
        'LV 14',
        'Supply Yard',
        'Dive impact shockwave & crate breaking',
        -4.6,
        5.8,
        [
          solid('mt-floor', 0, 0, 17.0, 1.4),
          pass('mt-perch', -4.5, 4.8, 4.4, 0.45),
          crate('mt-c1', 3.0, 1.35),
          crate('mt-c2', 3.0, 2.7),
        ]
      ),
    buildBots: () => [
      { x: 4.8, y: 1.4, archetypeId: 'imp', policy: 'brawler', name: 'Target Dummy' },
    ],
    items: [
      { id: 'meteor_on', label: () => 'Trigger METEOR (Jump → Dive)' },
      { id: 'meteor_smash', label: () => 'Shatter a crate or strike the target with METEOR' },
    ],
    evaluate: ({ sim, player, events, progress }) => {
      if (player.activeMech?.id === 'meteor') progress.flags.meteor_on = true;
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'mech_trigger' && ev.mechId === 'meteor') {
          progress.flags.meteor_on = true;
        }
        if (
          progress.flags.meteor_on &&
          (ev.type === 'crate_break' ||
            (ev.fighterId === player.id && (ev.type === 'mech_pulse' || ev.type === 'attack_hit')))
        ) {
          if (sim.fighters.some((f) => !f.isHuman && f.hitFlashTimer > 0) || ev.type === 'crate_break') {
            progress.flags.meteor_smash = true;
          }
        }
      }
    },
  },

  // =========================================================================
  // 15. GRAPPLE III — Living Hook & Reel Pull
  // =========================================================================
  {
    id: 'grp-3',
    number: 15,
    category: 'Grapple III',
    tier: 'tactics',
    title: 'Grapple III · Living Hook & Reel Pull',
    shortTitle: 'Grapple III: Pull Ambush',
    paceScale: 0.90,
    paceLabel: '0.90× Measured',
    botBehavior: 'passive_evader',
    botAggression: 0.15,
    botHomeX: 5.8,
    failLimit: 2,
    rerouteToId: 'grp-1',
    rerouteReason: 'Practice aiming your hook ray cleanly before snapping onto moving targets.',
    instruction:
      'Hooks latch onto bodies too! Aim your grappling hook onto the evasive Runner across the gorge (or the deck beside it), hold Pull to reel in, and land a Strike!',
    reteachInstruction:
      'Reteach Mode: Fire Hook toward the Runner on the right cliff and hold Pull to close the entire gap.',
    getHint: (h) => `${getControlBindings(h).grapple} at rival → hold ${getControlBindings(h).pull} to Reel In → ${getControlBindings(h).attack}`,
    waypointX: 5.8,
    waypointY: 2.3,
    buildArena: () =>
      makeArenaBase(
        'LV 15',
        'Chain Crossing',
        'Reel-in ambush over chasm',
        -6.8,
        1.6,
        [
          solid('g3-l', -6.8, 0.2, 5.2, 1.3),
          solid('g3-r', 5.8, 0.2, 8.2, 1.3),
        ],
        [{ id: 'g3-a', x: 0, y: 7.4, radius: 0.4 }]
      ),
    buildBots: () => [
      { x: 5.8, y: 1.6, archetypeId: 'nova', policy: 'acrobat', name: 'Fleet Runner' },
    ],
    items: [
      { id: 'reel_pull', label: () => 'Hook & hold Pull to reel across/into the target' },
      { id: 'pull_strike', label: () => 'Land a Strike after reeling in' },
    ],
    evaluate: ({ player, events, pullHeld, progress }) => {
      if (player.grapple.active && player.grapple.phase === 'attached' && pullHeld) {
        progress.flags.reel_pull = true;
        progress.timers.pullGrace = 2.6;
      }
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'attack_hit' && (progress.timers.pullGrace ?? 0) > 0) {
          progress.flags.pull_strike = true;
        }
      }
    },
  },

  // =========================================================================
  // 16. MECH III — THUNDERBOLT (Dash -> Slide)
  // =========================================================================
  {
    id: 'mch-3',
    number: 16,
    category: 'Mech III · Thunderbolt',
    tier: 'tactics',
    title: 'Mech III · THUNDERBOLT (Dash → Slide)',
    shortTitle: 'Mech III: THUNDERBOLT',
    paceScale: 0.91,
    paceLabel: '0.91× Brisk',
    botBehavior: 'patrol_guard',
    botAggression: 0.35,
    botHomeX: 4.2,
    targetMech: 'thunderbolt',
    failLimit: 2,
    rerouteToId: 'eva-1',
    rerouteReason: 'Revisit Low-Profile Slide timing before combining it with Dash.',
    instruction:
      'Blitz beneath the stone gate with Dash → Slide to trigger THUNDERBOLT and shock the Sentinel waiting on the far side!',
    reteachInstruction:
      'Reteach Mode: Press Dash while grounded, then press Slide immediately before the gate.',
    getHint: (h) => `${getControlBindings(h).dash} → ${getControlBindings(h).slide} = THUNDERBOLT low lightning burst`,
    waypointX: 4.2,
    waypointY: 1.7,
    buildArena: () =>
      makeArenaBase(
        'LV 16',
        'Storm Gate',
        'Low-profile electric blitz',
        -6.8,
        1.4,
        [
          solid('tb-floor', 0, 0, 18.0, 1.4),
          solid('tb-gate', -0.8, 3.0, 2.4, 2.2, '#6b5e68'),
        ]
      ),
    buildBots: () => [
      { x: 4.2, y: 1.4, archetypeId: 'volt', policy: 'brawler', name: 'Gate Sentinel' },
    ],
    items: [
      { id: 'tb_on', label: () => 'Trigger THUNDERBOLT (Dash → Slide)' },
      { id: 'tb_hit', label: () => 'Zap or strike the Sentinel with THUNDERBOLT' },
    ],
    evaluate: ({ sim, player, events, progress }) => {
      if (player.activeMech?.id === 'thunderbolt') progress.flags.tb_on = true;
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'mech_trigger' && ev.mechId === 'thunderbolt') {
          progress.flags.tb_on = true;
        }
        if (
          progress.flags.tb_on &&
          ev.fighterId === player.id &&
          (ev.type === 'mech_pulse' || ev.type === 'attack_hit') &&
          sim.fighters.some((f) => !f.isHuman && f.hitFlashTimer > 0)
        ) {
          progress.flags.tb_hit = true;
        }
      }
    },
  },

  // =========================================================================
  // 17. COMBAT II — Bait, Step Back & Punish (Tactical Movement!)
  // =========================================================================
  {
    id: 'cbt-2',
    number: 17,
    category: 'Combat II',
    tier: 'tactics',
    title: 'Combat II · Bait, Step Out & Punish (Footsies)',
    shortTitle: 'Combat II: Bait & Punish',
    paceScale: 0.92,
    paceLabel: '0.92× Brisk',
    botBehavior: 'telegraphed_striker',
    botAggression: 0.45,
    botHomeX: 2.2,
    failLimit: 2,
    rerouteToId: 'def-1',
    rerouteReason: 'Tighten up Strike windup reads in Defense I before footsie baiting.',
    instruction:
      'How to win neutral without trading damage: step close to draw out the Sentinel’s swing, step left/right out of range (or parry) so it whiffs, then immediately punish with 2 Strikes!',
    reteachInstruction:
      'Reteach Mode: Walk near until it raises its blade, step 2 paces back cleanly, then dash/step in and Strike.',
    getHint: () => 'Step in to bait swing → step back cleanly → counter-strike during recovery',
    waypointX: 2.2,
    waypointY: 2.0,
    buildArena: () =>
      makeArenaBase(
        'LV 17',
        'Duels Courtyard',
        'Spacing bait & punish tactics',
        -5.0,
        1.4,
        [solid('c2-floor', 0, 0, 17.0, 1.4)]
      ),
    buildBots: () => [
      { x: 2.2, y: 1.4, archetypeId: 'reaper', policy: 'brawler', name: 'Iron Duelist' },
    ],
    items: [
      { id: 'baited', label: () => 'Evade or Parry a Sentinel attack at close range' },
      { id: 'punished', label: () => 'Punish cleanly after baiting (2 counter-strikes)' },
    ],
    evaluate: ({ sim, player, events, progress }) => {
      const bot = sim.fighters.find((f) => !f.isHuman && f.alive);
      if (bot && bot.attack.phase === 'recovery' && player.hitstunTimer <= 0) {
        if (Math.hypot(bot.x - player.x, bot.y - player.y) < 3.6) {
          progress.flags.baited = true;
          progress.timers.punishWindow = 2.0;
        }
      }
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'parry') {
          progress.flags.baited = true;
          progress.timers.punishWindow = 2.0;
        }
        if (ev.fighterId === player.id && ev.type === 'attack_hit' && (progress.timers.punishWindow ?? 0) > 0) {
          progress.counters.punishes = (progress.counters.punishes ?? 0) + 1;
          if (progress.counters.punishes >= 2) progress.flags.punished = true;
        }
      }
    },
  },

  // =========================================================================
  // 18. MECH IV — BULLDOZER (Run -> Slide -> Dash)
  // =========================================================================
  {
    id: 'mch-4',
    number: 18,
    category: 'Mech IV · Bulldozer',
    tier: 'tactics',
    title: 'Mech IV · BULLDOZER (Run → Slide → Dash)',
    shortTitle: 'Mech IV: BULLDOZER',
    paceScale: 0.93,
    paceLabel: '0.93× Brisk',
    botBehavior: 'patrol_guard',
    botAggression: 0.4,
    botHomeX: 4.8,
    targetMech: 'bulldozer',
    failLimit: 2,
    rerouteToId: 'mch-3',
    rerouteReason: 'Practice Dash/Slide chaining on Thunderbolt before adding the Run windup.',
    instruction:
      'Break a fortified barricade! Build a steady Run, transition smoothly into Slide, then snap Dash to unleash BULLDOZER and plow through crates and defender alike!',
    reteachInstruction:
      'Reteach Mode: Hold forward for a half-second first so Run registers, then tap Slide → Dash.',
    getHint: (h) => `Steady ${getControlBindings(h).move} → ${getControlBindings(h).slide} → ${getControlBindings(h).dash} = BULLDOZER`,
    waypointX: 4.8,
    waypointY: 2.0,
    buildArena: () =>
      makeArenaBase(
        'LV 18',
        'Barricade Run',
        'Heavy armored ram breakthrough',
        -7.8,
        1.4,
        [
          solid('bd-floor', 0, 0, 19.5, 1.4),
          crate('bd-c1', 1.4, 1.35, 20),
          crate('bd-c2', 2.8, 1.35, 20),
        ]
      ),
    buildBots: () => [
      { x: 5.4, y: 1.4, archetypeId: 'titan', policy: 'brawler', name: 'Shield Guard' },
    ],
    items: [
      { id: 'bd_on', label: () => 'Ignite BULLDOZER (Run → Slide → Dash)' },
      { id: 'bd_ram', label: () => 'Ram through barricade & strike the Guard' },
    ],
    evaluate: ({ sim, player, events, progress }) => {
      if (player.activeMech?.id === 'bulldozer') progress.flags.bd_on = true;
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'mech_trigger' && ev.mechId === 'bulldozer') {
          progress.flags.bd_on = true;
        }
        if (
          progress.flags.bd_on &&
          ev.fighterId === player.id &&
          ev.type === 'attack_hit' &&
          sim.fighters.some((f) => !f.isHuman && f.hitFlashTimer > 0)
        ) {
          progress.flags.bd_ram = true;
        }
      }
    },
  },

  // =========================================================================
  // 19. MECH V — SPIDER (Grapple -> Wall Jump)
  // =========================================================================
  {
    id: 'mch-5',
    number: 19,
    category: 'Mech V · Spider',
    tier: 'tactics',
    title: 'Mech V · SPIDER (Hook → Wall Jump)',
    shortTitle: 'Mech V: SPIDER',
    paceScale: 0.94,
    paceLabel: '0.94× Brisk',
    botBehavior: 'patrol_guard',
    botAggression: 0.42,
    botHomeX: 6.4,
    targetMech: 'spider',
    failLimit: 2,
    rerouteToId: 'mov-4',
    rerouteReason: 'Sharpen chimney Wall Jumps in Movement IV before chaining Hook → Wall Jump.',
    instruction:
      'Hook onto the tall central monolith over the abyss, reel/touch the stone face, then kick straight into a Wall Jump to ignite SPIDER and vault onto the lookout ridge!',
    reteachInstruction:
      'Reteach Mode: Hook the monolith wall, hold Pull briefly to touch the brick, then immediately press Jump.',
    getHint: (h) => `${getControlBindings(h).grapple} at monolith wall → touch wall → ${getControlBindings(h).jump} = SPIDER`,
    waypointX: -0.6,
    waypointY: 4.8,
    targetZone: { x: 6.4, y: 4.0, w: 4.8, h: 1.4, label: 'SNIPER RIDGE' },
    buildArena: () =>
      makeArenaBase(
        'LV 19',
        'Spire Gorge',
        'Wall-snap redirection launch',
        -7.6,
        1.8,
        [
          solid('sp-l', -7.6, 0.4, 4.8, 1.3),
          solid('sp-wall', -0.2, 4.2, 1.3, 6.8, '#6b5e68'),
          solid('sp-r', 6.4, 2.8, 5.6, 1.3),
        ]
      ),
    buildBots: () => [
      { x: 6.4, y: 4.2, archetypeId: 'rift', policy: 'hunter', name: 'Ridge Lookout' },
    ],
    items: [
      { id: 'sp_on', label: () => 'Activate SPIDER (Grapple → Wall Jump)' },
      { id: 'sp_raid', label: () => 'Vault onto the sniper ridge & strike the Lookout' },
    ],
    evaluate: ({ player, events, progress }) => {
      if (player.activeMech?.id === 'spider') progress.flags.sp_on = true;
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'mech_trigger' && ev.mechId === 'spider') {
          progress.flags.sp_on = true;
        }
        if (progress.flags.sp_on && ev.fighterId === player.id && ev.type === 'attack_hit') {
          progress.flags.sp_raid = true;
        }
      }
    },
  },

  // =========================================================================
  // 20. MECH VI — COMET (Swing -> Dive)
  // =========================================================================
  {
    id: 'mch-6',
    number: 20,
    category: 'Mech VI · Comet',
    tier: 'tactics',
    title: 'Mech VI · COMET (Pendulum Swing → Dive)',
    shortTitle: 'Mech VI: COMET',
    paceScale: 0.95,
    paceLabel: '0.95× Brisk',
    botBehavior: 'patrol_guard',
    botAggression: 0.45,
    botHomeX: 6.8,
    targetMech: 'comet',
    failLimit: 2,
    rerouteToId: 'grp-2',
    rerouteReason: 'Practice Pendulum Swing speed in Grapple II so COMET ignites consistently.',
    instruction:
      'Hook the high timber beam over the gorge, build crisp rope Swing velocity, then snap directly into Dive to launch a gilded COMET impact onto the lower island!',
    reteachInstruction:
      'Reteach Mode: Pump Swing past peak speed over center pit, then tap Dive to crash downward.',
    getHint: (h) => `Hook beam → Swing fast with ${getControlBindings(h).move} → ${getControlBindings(h).dive} = COMET slam`,
    waypointX: 0,
    waypointY: 7.4,
    buildArena: () =>
      makeArenaBase(
        'LV 20',
        'Comet Abyss',
        'High-velocity swing-to-dive ambush',
        -8.4,
        3.8,
        [
          solid('cm-launch', -8.4, 2.4, 4.4, 1.2),
          solid('cm-beam', 0, 8.2, 2.8, 0.7, '#7d5a42'),
          solid('cm-land', 6.8, 0, 7.6, 1.4),
        ]
      ),
    buildBots: () => [
      { x: 6.8, y: 1.4, archetypeId: 'ember', policy: 'brawler', name: 'Island Champion' },
    ],
    items: [
      { id: 'cm_on', label: () => 'Ignite COMET (Swing → Dive)' },
      { id: 'cm_hit', label: () => 'Land COMET impact or strike on the island foe' },
    ],
    evaluate: ({ sim, player, events, progress }) => {
      if (player.activeMech?.id === 'comet') progress.flags.cm_on = true;
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'mech_trigger' && ev.mechId === 'comet') {
          progress.flags.cm_on = true;
        }
        if (
          progress.flags.cm_on &&
          ev.fighterId === player.id &&
          (ev.type === 'mech_pulse' || ev.type === 'attack_hit') &&
          sim.fighters.some((f) => !f.isHuman && f.hitFlashTimer > 0)
        ) {
          progress.flags.cm_hit = true;
        }
      }
    },
  },

  // =========================================================================
  // 21. HAZARDS I — Powder Kegs & Environmental KOs
  // =========================================================================
  {
    id: 'haz-1',
    number: 21,
    category: 'Hazards I',
    tier: 'tactics',
    title: 'Hazards I · Keg Traps & Environmental Knockouts',
    shortTitle: 'Hazards I: Trap Mastery',
    paceScale: 0.95,
    paceLabel: '0.95× Brisk',
    botBehavior: 'patrol_guard',
    botAggression: 0.5,
    botHomeX: 2.5,
    failLimit: 2,
    rerouteToId: 'cbt-2',
    rerouteReason: 'Revisit Bait & Punish positioning so you lure foes beside hazards safely.',
    instruction:
      'Use the arena itself as a weapon! Lure the Sentry near a Powder Keg and strike the barrel (or knock them into the drop) to detonate a keg blast and score 1 KO.',
    reteachInstruction:
      'Reteach Mode: Wait until the Sentry steps beside a red barrel, then strike the barrel from safe reach.',
    getHint: () => 'Strike red Powder Kegs when foes stand nearby — let explosions score heavy ring-outs!',
    waypointX: 3.5,
    waypointY: 2.0,
    buildArena: () =>
      makeArenaBase(
        'LV 21',
        'Powder Foundry',
        'Barrel explosions & trap routing',
        -6.5,
        1.4,
        [
          solid('hz-main', 0, 0, 14.5, 1.4),
          pass('hz-cat', 0, 3.8, 5.2, 0.45),
        ],
        [],
        [barrel('hz-b1', -2.5, 1.35), barrel('hz-b2', 3.5, 1.35)]
      ),
    buildBots: () => [
      { x: 2.5, y: 1.4, archetypeId: 'volt', policy: 'brawler', name: 'Foundry Guard', initialDamage: 35 },
    ],
    items: [
      { id: 'keg_blast', label: () => 'Detonate a Powder Keg blast' },
      { id: 'haz_ko', label: () => 'Score 1 knockout on the Guard' },
    ],
    evaluate: ({ events, progress }) => {
      for (const ev of events) {
        if (ev.type === 'barrel_explode') progress.flags.keg_blast = true;
        if (ev.type === 'ko' && ev.fighterId !== 0) progress.flags.haz_ko = true;
      }
    },
  },

  // =========================================================================
  // 22. MOVEMENT V — Tactical Positioning & Evasive Routing Under Chase (22nd Level!)
  // =========================================================================
  {
    id: 'mov-5',
    number: 22,
    category: 'Movement V',
    tier: 'mastery',
    title: 'Movement V · Evasive Routing Under Pursuit',
    shortTitle: 'Movement V: Tactical Flow',
    paceScale: 0.96,
    paceLabel: '0.96× High Tempo',
    botBehavior: 'chaser',
    botAggression: 0.65,
    botHomeX: 4.5,
    failLimit: 2,
    rerouteToId: 'mov-3',
    rerouteReason: 'Practice moving smoothly over mixed ledges before evading live pursuit.',
    instruction:
      'Moving in accordance with strategy: an aggressive Stalker hunts you across multi-level ledges. Rotate lanes using passthrough drops and upper decks to evade cleanly for 8 seconds, then land a counter-strike!',
    reteachInstruction:
      'Reteach Mode: Never corner yourself on the outer edges—cut back through the upper platform toward center!',
    getHint: (h) => `Drop through passthrough decks (${getControlBindings(h).slide}) & rotate lanes to break pursuit`,
    waypointX: 0,
    waypointY: 4.4,
    buildArena: () =>
      makeArenaBase(
        'LV 22',
        'Multi-Tier Sanctuary',
        'Strategic lane switching under chase',
        -5.0,
        1.4,
        [
          solid('m5-main', 0, 0, 15.0, 1.4),
          pass('m5-l', -4.5, 3.2, 3.8, 0.45),
          pass('m5-r', 4.5, 3.2, 3.8, 0.45),
          pass('m5-top', 0, 5.5, 4.4, 0.45),
        ],
        [{ id: 'm5-a', x: 0, y: 8.2, radius: 0.4 }]
      ),
    buildBots: () => [
      { x: 5.2, y: 1.4, archetypeId: 'reaper', policy: 'hunter', name: 'Relentless Stalker' },
    ],
    items: [
      { id: 'survive_chase', label: () => 'Evade & rotate across tiers cleanly for 8 seconds' },
      { id: 'counter_hit', label: () => 'Turn momentum into a clean counter-Strike' },
    ],
    evaluate: ({ player, events, dt, progress }) => {
      if (player.hitstunTimer <= 0) {
        progress.survivedSeconds += dt;
      }
      if (progress.survivedSeconds >= 8.0) {
        progress.flags.survive_chase = true;
      }
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'attack_hit' && progress.survivedSeconds >= 4.0) {
          progress.flags.counter_hit = true;
        }
      }
    },
  },

  // =========================================================================
  // 23. TACTICS I — Off-Stage Edge-Guarding
  // =========================================================================
  {
    id: 'tac-1',
    number: 23,
    category: 'Tactics I',
    tier: 'mastery',
    title: 'Tactics I · Off-Stage Edge-Guarding',
    shortTitle: 'Tactics I: Edge-Guard',
    paceScale: 0.97,
    paceLabel: '0.97× Live Tempo',
    botBehavior: 'patrol_guard',
    botAggression: 0.55,
    botHomeX: 3.5,
    failLimit: 2,
    rerouteToId: 'jmp-2',
    rerouteReason: 'Master Double-Jump conservation so you can chase off-stage and still return safely.',
    instruction:
      'Once you knock an enemy off-stage, do not just stand in center! Chase out past the lip or hold the edge to intercept their recovery and claim 1 ring-out KO.',
    reteachInstruction:
      'Reteach Mode: Launch the defender toward the right ledge, then follow with an aerial Strike or Dash!',
    getHint: () => 'Knock foe off the ledge → intercept recovery in midair → land safely with Double Jump or Hook',
    waypointX: 5.5,
    waypointY: 2.2,
    buildArena: () =>
      makeArenaBase(
        'LV 23',
        'Edge Cliff',
        'Off-stage interception & denial',
        -4.0,
        1.4,
        [solid('tc1-main', 0, 0, 12.0, 1.4)],
        [{ id: 'tc1-a1', x: -5.5, y: 6.8, radius: 0.4 }, { id: 'tc1-a2', x: 5.5, y: 6.8, radius: 0.4 }]
      ),
    buildBots: () => [
      { x: 3.6, y: 1.4, archetypeId: 'rift', policy: 'acrobat', name: 'Edge Diver', initialDamage: 55 },
    ],
    items: [
      { id: 'offstage_hit', label: () => 'Strike or pressure an opponent beyond the cliff lip (|x| > 5.5)' },
      { id: 'edge_ko', label: () => 'Finish the ring-out Knockout' },
    ],
    evaluate: ({ sim, player, events, progress }) => {
      const bot = sim.fighters.find((f) => !f.isHuman);
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'attack_hit' && Math.abs(player.x) > 4.2) {
          progress.flags.offstage_hit = true;
        }
        if (bot && bot.alive && Math.abs(bot.x) > 6.2 && ev.fighterId === player.id && ev.type === 'attack_hit') {
          progress.flags.offstage_hit = true;
        }
        if (ev.type === 'ko' && ev.fighterId !== player.id) {
          progress.flags.edge_ko = true;
        }
      }
    },
  },

  // =========================================================================
  // 24. TACTICS II — Hit-Confirm & Follow-Up Chain
  // =========================================================================
  {
    id: 'tac-2',
    number: 24,
    category: 'Tactics II',
    tier: 'mastery',
    title: 'Tactics II · Combo Chaining & Tech-Chase',
    shortTitle: 'Tactics II: Combo Chain',
    paceScale: 0.98,
    paceLabel: '0.98× Live Tempo',
    botBehavior: 'patrol_guard',
    botAggression: 0.6,
    botHomeX: 2.5,
    failLimit: 2,
    rerouteToId: 'cbt-2',
    rerouteReason: 'Revisit Bait & Punish so your opening confirm connects cleanly.',
    instruction:
      'One hit is only half a punish: land an opening Strike, read where the rival flies, and chase immediately (Dash, Jump, or Hook Pull) to land a second follow-up hit within 1.6 seconds!',
    reteachInstruction:
      'Reteach Mode: The instant your first hit connects, press Dash toward the flying rival and Strike again.',
    getHint: () => 'Strike → immediately Dash or Jump-chase knockback → second Strike within 1.6s!',
    waypointX: 2.5,
    waypointY: 2.0,
    buildArena: () =>
      makeArenaBase(
        'LV 24',
        'Combo Dojo',
        'Hit-confirm pursuit & combo strings',
        -5.0,
        1.4,
        [
          solid('tc2-main', 0, 0, 16.5, 1.4),
          pass('tc2-l', -4.2, 3.2, 3.6, 0.45),
          pass('tc2-r', 4.2, 3.2, 3.6, 0.45),
        ]
      ),
    buildBots: () => [
      { x: 2.5, y: 1.4, archetypeId: 'nova', policy: 'acrobat', name: 'Sparring Acrobat', initialDamage: 20 },
    ],
    items: [
      { id: 'chain_2', label: () => 'Connect a 2-hit follow-up chain within 1.6 seconds' },
      { id: 'chain_ko', label: () => 'Convert pressure into 1 Knockout' },
    ],
    evaluate: ({ player, events, dt, progress }) => {
      progress.recentHitTimer = Math.max(0, progress.recentHitTimer - dt);
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'attack_hit') {
          if (progress.recentHitTimer > 0) {
            progress.flags.chain_2 = true;
          }
          progress.recentHitTimer = 1.6;
        }
        if (ev.type === 'ko' && ev.fighterId !== player.id) {
          progress.flags.chain_ko = true;
        }
      }
    },
  },

  // =========================================================================
  // 25. STRATEGY I — Positional Advantage at High Damage
  // =========================================================================
  {
    id: 'str-1',
    number: 25,
    category: 'Strategy I',
    tier: 'mastery',
    title: 'Strategy I · Playing from Behind (High % Risk)',
    shortTitle: 'Strategy I: High Ground',
    paceScale: 0.98,
    paceLabel: '0.98× Match Speed',
    botBehavior: 'chaser',
    botAggression: 0.78,
    botHomeX: 4.5,
    playerStartDamage: 55,
    failLimit: 2,
    rerouteToId: 'mov-5',
    rerouteReason: 'Revisit Movement V evasive routing before playing from 55% damage deficit.',
    instruction:
      'You begin wounded at 55% against a healthy challenger. Reckless trades will launch you! Hold elevated high ground, bait & parry openings, and steal 1 comeback Knockout!',
    reteachInstruction:
      'Reteach Mode: Control the elevated stone platforms, guard heavy swings, and strike on counter-windows.',
    getHint: () => 'At high %: avoid reckless flat trades · Hold high ground · Parry & counter-strike!',
    waypointX: 0,
    waypointY: 4.5,
    buildArena: () =>
      makeArenaBase(
        'LV 25',
        'Citadel Crown',
        'High-ground risk management at 55% damage',
        -4.5,
        1.4,
        [
          solid('st1-main', 0, 0, 14.0, 1.4),
          pass('st1-high', 0, 4.2, 5.2, 0.45),
          pass('st1-l', -5.4, 2.5, 3.2, 0.45),
          pass('st1-r', 5.4, 2.5, 3.2, 0.45),
        ]
      ),
    buildBots: () => [
      { x: 4.5, y: 1.4, archetypeId: 'titan', policy: 'brawler', name: 'Fresh Challenger', initialDamage: 0 },
    ],
    items: [
      { id: 'defend_or_mech', label: () => 'Trigger a Parry or combo Mech from high ground' },
      { id: 'comeback_ko', label: () => 'Score the comeback Knockout without falling!' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && (ev.type === 'parry' || ev.type === 'mech_trigger')) {
          progress.flags.defend_or_mech = true;
        }
        if (ev.type === 'ko' && ev.fighterId !== player.id) {
          progress.flags.comeback_ko = true;
        }
      }
    },
  },

  // =========================================================================
  // 26. STRATEGY II — Reading & Adapting to Contrasting Opponents
  // =========================================================================
  {
    id: 'str-2',
    number: 26,
    category: 'Strategy II',
    tier: 'mastery',
    title: 'Strategy II · Reading & Adapting to Styles',
    shortTitle: 'Strategy II: Adaptation',
    paceScale: 0.99,
    paceLabel: '0.99× Match Speed',
    botBehavior: 'chaser',
    botAggression: 0.82,
    botHomeX: 4.0,
    failLimit: 2,
    rerouteToId: 'def-1',
    rerouteReason: 'Revisit Parry & Spacing to shut down fast rushdown pressure cleanly.',
    instruction:
      'One tactic cannot beat every style. You face both a heavy rushdown Brawler and an agile Acrobat—bait/parry the rusher and grapple/dash-chase the evader to score 2 KOs!',
    reteachInstruction:
      'Reteach Mode: Separate the two rivals across platforms—use Guard/Parry on the heavy rusher first.',
    getHint: () => 'Bait & Parry rushdown brawlers · Hook & Dash-chase mobile acrobats (2 KOs)',
    waypointX: 3.5,
    waypointY: 2.2,
    buildArena: () =>
      makeArenaBase(
        'LV 26',
        'Twin Rival Arena',
        'Adapting between rushdown and evasive archetypes',
        -6.0,
        1.4,
        [
          solid('st2-main', 0, 0, 15.0, 1.4),
          pass('st2-mid', 0, 3.6, 5.4, 0.45),
        ],
        [{ id: 'st2-a1', x: -5.5, y: 7.2, radius: 0.4 }, { id: 'st2-a2', x: 5.5, y: 7.2, radius: 0.4 }]
      ),
    buildBots: () => [
      { x: 2.8, y: 1.4, archetypeId: 'titan', policy: 'brawler', name: 'Heavy Rusher', initialDamage: 25 },
      { x: 6.2, y: 1.4, archetypeId: 'nova', policy: 'acrobat', name: 'Sky Acrobat', initialDamage: 25 },
    ],
    items: [
      { id: 'ko_1', label: () => 'Knock out 1 rival using tactical adaptation' },
      { id: 'ko_2', label: () => 'Finish the second rival (2 KOs total)' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.type === 'ko' && ev.fighterId !== player.id) {
          progress.counters.kos = (progress.counters.kos ?? 0) + 1;
          progress.flags.ko_1 = true;
          if (progress.counters.kos >= 2) progress.flags.ko_2 = true;
        }
      }
    },
  },

  // =========================================================================
  // 27. STRATEGY III — Formulating Your Own Strategy
  // =========================================================================
  {
    id: 'str-3',
    number: 27,
    category: 'Strategy III',
    tier: 'mastery',
    title: 'Strategy III · Formulate Your Own Win Plan',
    shortTitle: 'Strategy III: Your Gameplan',
    paceScale: 1.0,
    paceLabel: '1.0× Live Speed',
    botBehavior: 'chaser',
    botAggression: 0.9,
    botHomeX: 5.5,
    failLimit: 2,
    rerouteToId: 'str-1',
    rerouteReason: 'Revisit Risk Management before leading your own open-sandbox strategy.',
    instruction:
      'Design your own winning tactic! This sandbox packs conveyor flanks, a Powder Keg, breakable crates, and an overhead swing beam. Combine ANY Mech + terrain advantage to take 2 KOs from the Champion!',
    reteachInstruction:
      'Reteach Mode: Pick your strongest opening—Hook-Comet dive, Barrel trap, or Edge-Guard—and commit to it.',
    getHint: () => 'Choose your own route: Chain a Mech + exploit barrels/conveyors/edges to win 2 KOs!',
    waypointX: 5.0,
    waypointY: 2.2,
    buildArena: () =>
      makeArenaBase(
        'LV 27',
        'Tactician Sandbox',
        'Build and execute your own winning strategy',
        -6.8,
        1.4,
        [
          solid('st3-main', 0, 0, 13.0, 1.4),
          {
            id: 'st3-conv',
            x: -8.6,
            y: 1.4,
            w: 4.5,
            h: 0.8,
            kind: 'conveyor',
            conveyorSpeed: 4.2,
            grappleable: true,
            ledgeGrabbable: true,
            color: '#463f47',
          },
          pass('st3-top', 0, 4.4, 4.8, 0.45),
          solid('st3-beam', 5.5, 7.6, 2.6, 0.7, '#7d5a42'),
          crate('st3-cr', -2.5, 1.35, 25),
        ],
        [{ id: 'st3-a1', x: -5.2, y: 7.6, radius: 0.4 }],
        [barrel('st3-b1', 3.8, 1.35)]
      ),
    buildBots: () => [
      { x: 5.5, y: 1.4, archetypeId: 'volt', policy: 'hunter', name: 'Arena Tactician', initialDamage: 15 },
    ],
    items: [
      { id: 'own_tool', label: () => 'Execute a Mech OR Powder Keg play in your plan' },
      { id: 'plan_kos', label: () => 'Score 2 KOs using your chosen strategy' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if ((ev.fighterId === player.id && ev.type === 'mech_trigger') || ev.type === 'barrel_explode') {
          progress.flags.own_tool = true;
        }
        if (ev.type === 'ko' && ev.fighterId !== player.id) {
          progress.counters.kos = (progress.counters.kos ?? 0) + 1;
          if (progress.counters.kos >= 2) progress.flags.plan_kos = true;
        }
      }
    },
  },

  // =========================================================================
  // 28. MASTERY TRIAL — Grand Procedural Crucible Finale
  // =========================================================================
  {
    id: 'mst-1',
    number: 28,
    category: 'Mastery Trial',
    tier: 'mastery',
    title: 'Mastery Trial · The Grand Crucible',
    shortTitle: 'Mastery Trial: Graduation',
    paceScale: 1.0,
    paceLabel: '1.0× Live Speed',
    botBehavior: 'chaser',
    botAggression: 1.0,
    botHomeX: 5.0,
    failLimit: 2,
    rerouteToId: 'str-3',
    rerouteReason: 'Hone your personal win gameplan in Strategy III before facing the Grand Trial.',
    instruction:
      'Final Graduation Trial at full match speed! Chain at least 2 distinct Mechs and claim 3 Knockouts across this procedurally randomized championship arena.',
    reteachInstruction:
      'Reteach Mode: Stay calm in center, chain safe Mechs (Meteor / Bulldozer / Comet), and secure edge KOs.',
    getHint: () => 'Chain 2 different Mechs + claim 3 total Knockouts against the Duelists!',
    waypointX: 4.5,
    waypointY: 2.4,
    buildArena: (seed) => {
      const shift = ((seed % 5) - 2) * 0.7;
      return makeArenaBase(
        'LV 28',
        'Grand Crucible',
        'Final mastery exam at live match tempo',
        -7.2,
        1.6,
        [
          solid('ms-main', 0, 0, 14.5 + Math.abs(shift), 1.4),
          pass('ms-l', -4.8 + shift * 0.4, 3.2, 3.8, 0.45),
          pass('ms-r', 4.8 - shift * 0.4, 3.4, 3.8, 0.45),
          solid('ms-beam', shift, 7.6, 2.8, 0.7, '#7d5a42'),
          {
            id: 'ms-crumb',
            x: 9.6,
            y: 1.2,
            w: 3.2,
            h: 0.55,
            kind: 'crumbling',
            crumbleTimer: 0,
            broken: false,
            respawnTimer: 0,
            grappleable: true,
            ledgeGrabbable: true,
            color: '#8f6b7d',
          },
        ],
        [
          { id: 'ms-a1', x: -6.5, y: 7.8, radius: 0.4 },
          { id: 'ms-a2', x: 6.5, y: 7.8, radius: 0.4 },
        ],
        [barrel('ms-b1', shift * 0.5, 1.35)]
      );
    },
    buildBots: (seed) => {
      const pool = FIGHTER_ARCHETYPES.slice(1);
      const a1 = pool[seed % pool.length];
      const a2 = pool[(seed + 3) % pool.length];
      return [
        { x: 4.2, y: 1.6, archetypeId: a1.id, policy: 'brawler', name: `${a1.name} · Master`, initialDamage: 15 },
        { x: 7.0, y: 3.8, archetypeId: a2.id, policy: 'acrobat', name: `${a2.name} · Ace`, initialDamage: 15 },
      ];
    },
    items: [
      { id: 'two_mechs', label: () => 'Chain 2 distinct automatic Mechs in combat' },
      { id: 'three_kos', label: () => 'Score 3 Knockouts to graduate from the Academy' },
    ],
    evaluate: ({ player, events, progress }) => {
      for (const ev of events) {
        if (ev.fighterId === player.id && ev.type === 'mech_trigger' && ev.mechId) {
          if (!progress.mechsSeen.includes(ev.mechId)) {
            progress.mechsSeen.push(ev.mechId);
          }
          if (progress.mechsSeen.length >= 2) {
            progress.flags.two_mechs = true;
          }
        }
        if (ev.type === 'ko' && ev.fighterId !== player.id) {
          progress.counters.kos = (progress.counters.kos ?? 0) + 1;
          if (progress.counters.kos >= 3) progress.flags.three_kos = true;
        }
      }
    },
  },
];

export interface AcademyLevelSummary {
  id: string;
  number: number;
  category: string;
  tier: TutorialTier;
  shortTitle: string;
  paceLabel: string;
  rerouteToId: string;
  targetMech?: MechId;
}

export function getAcademyLevelSummaries(): AcademyLevelSummary[] {
  return ACADEMY_LEVELS.map((l) => ({
    id: l.id,
    number: l.number,
    category: l.category,
    tier: l.tier,
    shortTitle: l.shortTitle,
    paceLabel: l.paceLabel,
    rerouteToId: l.rerouteToId,
    targetMech: l.targetMech,
  }));
}

export function formatAcademyItems(
  def: AcademyLevelDef,
  handedness: Handedness,
  progress: AcademyProgressState,
  completed: boolean
): TutorialCheckItem[] {
  return def.items.map((it) => ({
    id: it.id,
    label: it.label(handedness),
    done: completed || Boolean(progress.flags[it.id]),
  }));
}

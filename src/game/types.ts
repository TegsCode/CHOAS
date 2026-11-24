export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover' | 'replay';

export type ArenaId =
  | 'islands'
  | 'meadow'
  | 'canopy'
  | 'factory'
  | 'furnace'
  | 'tutorial'
  | 'crucible';

export type GameMode =
  | 'last_standing'
  | 'stock_brawl'
  | 'team_chaos'
  | 'king_of_platform';

export type Handedness = 'right' | 'left';

export type TutorialMode = 'basics' | 'crucible';

export type TutorialTier = 'beginner' | 'foundation' | 'tactics' | 'mastery';

export type TutorialBotBehavior =
  | 'none'
  | 'dummy'
  | 'telegraphed_striker'
  | 'passive_evader'
  | 'patrol_guard'
  | 'chaser';

export type MovementVerb =
  | 'run'
  | 'jump'
  | 'double_jump'
  | 'dash'
  | 'slide'
  | 'wall_jump'
  | 'grapple'
  | 'swing'
  | 'pull'
  | 'ledge_grab'
  | 'dive';

export type MechId =
  | 'phantom'
  | 'meteor'
  | 'thunderbolt'
  | 'spider'
  | 'comet'
  | 'bulldozer';

export type FighterArchetypeId =
  | 'ember'
  | 'wraith'
  | 'rift'
  | 'volt'
  | 'titan'
  | 'nova'
  | 'reaper'
  | 'imp';

export interface FighterArchetype {
  id: FighterArchetypeId;
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  eyeColor: string;
  headStyle:
    | 'flame'
    | 'horned_mask'
    | 'hood'
    | 'ronin_hat'
    | 'brute_horns'
    | 'cyber_visor'
    | 'skull_hood'
    | 'imp_horns';
  cloakStyle: 'tattered' | 'cape' | 'scarf' | 'mantle';
  weaponStyle: 'staff' | 'blade' | 'gauntlets' | 'scythe' | 'none';
  scale: number;
}

export interface MechDefinition {
  id: MechId;
  name: string;
  sequence: MovementVerb[];
  role: string;
  description: string;
  color: string;
  secondaryColor: string;
  windowSeconds: number;
  cooldownSeconds: number;
}

export interface PlayerInput {
  moveX: number; // -1, 0, 1
  moveY: number; // -1 (down), 0, 1 (up)
  jumpHeld: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
  slideHeld: boolean;
  slidePressed: boolean;
  grappleHeld: boolean;
  grapplePressed: boolean;
  pullHeld: boolean;
  divePressed: boolean;
  attackPressed: boolean;
  defendHeld: boolean;
  aimX?: number;
  aimY?: number;
}

export interface ActionStamp {
  verb: MovementVerb;
  time: number;
  meta?: number;
}

export interface GrappleState {
  active: boolean;
  phase: 'none' | 'firing' | 'attached';
  targetType: 'surface' | 'player';
  targetPlayerId: number | null;
  anchorX: number;
  anchorY: number;
  hookX: number;
  hookY: number;
  length: number;
  maxLength: number;
  swingSpeed: number;
  attachedTime: number;
}

export interface AttackState {
  phase: 'none' | 'windup' | 'active' | 'recovery';
  timer: number;
  dirX: number;
  dirY: number;
  hitIds: number[];
  momentumBonus: number;
}

export interface ActiveMechState {
  id: MechId;
  remaining: number;
  duration: number;
  power: number;
}

export interface FighterState {
  id: number;
  name: string;
  isHuman: boolean;
  playerSlot: number; // 0 = P1, 1 = P2 (local or online slot), -1 = AI
  archetype: FighterArchetype;
  alive: boolean;
  eliminatedAt: number | null;
  eliminatedBy: number | null;
  kos: number;
  deaths: number;
  mechsTriggered: number;

  // Mode state
  stocks: number;
  maxStocks: number;
  respawnTimer: number;
  spawnInvulnTimer: number;
  teamId: 0 | 1 | null;
  kingScore: number;

  // 2D-plane physics coordinates
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 1 | -1;

  // Ground & wall contact
  grounded: boolean;
  groundPlatformId: string | null;
  coyoteTimer: number;
  jumpBufferTimer: number;
  doubleJumpAvailable: boolean;
  onWall: -1 | 0 | 1;
  wallCoyoteTimer: number;
  lastWallSide: -1 | 0 | 1;

  // Movement states
  dashTimer: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirY: number;
  slideTimer: number;
  slideCooldown: number;
  diveActive: boolean;
  diveSpeed: number;
  ledgeGrab: {
    active: boolean;
    platformId: string | null;
    side: -1 | 1;
    ledgeX: number;
    ledgeY: number;
    timer: number;
  };
  ledgeCooldown: number;

  // Grapple & Swing & Pull
  grapple: GrappleState;

  // Combat & Physics Damage
  damagePercent: number;
  hitstunTimer: number;
  hitFlashTimer: number;
  ragdollSpin: number;
  ragdollAngle: number;
  attack: AttackState;
  attackCooldown: number;
  defending: boolean;
  defendTimer: number;
  posture: number;
  guardBreakTimer: number;
  lastHitBy: number | null;
  lastHitTime: number;

  // Mech system
  actionHistory: ActionStamp[];
  activeMech: ActiveMechState | null;
  mechCooldowns: Record<MechId, number>;
  runStreakTime: number;
  intangibleToPlayers: boolean;

  // Visual procedural animation state
  strideDistance: number;
  squashX: number;
  squashY: number;
  aiPolicy: 'brawler' | 'acrobat' | 'hunter' | 'opportunist';
  aiTimer: number;
  aiTargetId: number | null;
}

export interface PlatformRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'solid' | 'passthrough' | 'conveyor' | 'destructible' | 'crumbling' | 'moving';
  conveyorSpeed?: number;
  hp?: number;
  maxHp?: number;
  broken?: boolean;
  respawnTimer?: number;
  crumbleTimer?: number;
  baseX?: number;
  baseY?: number;
  moveAmpX?: number;
  moveAmpY?: number;
  moveFreq?: number;
  movePhase?: number;
  grappleable: boolean;
  ledgeGrabbable: boolean;
  color: string;
}

export interface GrappleAnchor {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface HazardZone {
  id: string;
  kind: 'lava' | 'crusher' | 'barrel';
  x: number;
  y: number;
  w: number;
  h: number;
  baseY: number;
  active: boolean;
  warningTimer: number;
  cycleTimer: number;
  exploded?: boolean;
  respawnTimer?: number;
  knockback: number;
  lethal: boolean;
}

export interface KingZoneSpot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KingZoneState extends KingZoneSpot {
  controllerId: number | null;
  contested: boolean;
  shiftTimer: number;
  spotIndex: number;
}

export interface ArenaConfig {
  id: ArenaId;
  name: string;
  subtitle: string;
  description: string;
  blastBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  spawnPoints: Array<{ x: number; y: number }>;
  kingZones?: KingZoneSpot[];
  platforms: PlatformRect[];
  anchors: GrappleAnchor[];
  hazards: HazardZone[];
  skyColor: string;
  fogColor: string;
  accentColor: string;
}

export interface SimEvent {
  type:
    | 'jump'
    | 'double_jump'
    | 'land'
    | 'dash'
    | 'slide'
    | 'wall_jump'
    | 'grapple_fire'
    | 'grapple_attach'
    | 'grapple_release'
    | 'ledge_grab'
    | 'dive_start'
    | 'dive_impact'
    | 'attack_swing'
    | 'attack_hit'
    | 'parry'
    | 'guard_block'
    | 'mech_trigger'
    | 'mech_pulse'
    | 'crate_break'
    | 'barrel_explode'
    | 'ko'
    | 'respawn'
    | 'tutorial_fall';
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fighterId?: number;
  targetId?: number;
  mechId?: MechId;
  power?: number;
  color?: string;
}

export interface SimulationState {
  arenaId: ArenaId;
  gameMode: GameMode;
  timeLimitSeconds: number | null;
  elapsed: number;
  hitstopTimer: number;
  trauma: number;
  blastBounds: ArenaConfig['blastBounds'];
  platforms: PlatformRect[];
  anchors: GrappleAnchor[];
  hazards: HazardZone[];
  kingZone: KingZoneState | null;
  kingSpots: KingZoneSpot[];
  teamScores: [number, number];
  fighters: FighterState[];
  events: SimEvent[];
  winnerId: number | null;
  winningTeam: 0 | 1 | null;
  matchFinished: boolean;
  finishDelayTimer: number;
  escalationLevel: number;
  isTutorial?: boolean;
  tutorialMode?: TutorialMode;
  dummyRespawnTimer?: number;
  tutorialPaceScale?: number;
  tutorialBotBehavior?: TutorialBotBehavior;
  tutorialBotAggression?: number;
  tutorialBotHomeX?: number;
  tutorialSafeSpawn?: { x: number; y: number };
}

export interface HudFighterSummary {
  id: number;
  name: string;
  isHuman: boolean;
  playerSlot: number;
  archetypeId: FighterArchetypeId;
  primaryColor: string;
  accentColor: string;
  alive: boolean;
  damagePercent: number;
  kos: number;
  deaths: number;
  stocks: number;
  maxStocks: number;
  teamId: 0 | 1 | null;
  kingScore: number;
  respawnTimer: number;
  spawnInvuln: boolean;
  posture: number;
  activeMech: MechId | null;
  activeMechColor: string | null;
  grappling: boolean;
}

export interface MatchResultSummary {
  gameMode: GameMode;
  winnerId: number | null;
  winningTeam: 0 | 1 | null;
  winnerName: string;
  winnerColor: string;
  humanWon: boolean;
  humanPlacement: number;
  totalFighters: number;
  durationSeconds: number;
  humanKos: number;
  humanMechs: number;
  arenaId?: ArenaId;
  arenaName: string;
  standings: Array<{
    id: number;
    name: string;
    isHuman: boolean;
    color: string;
    alive: boolean;
    kos: number;
    deaths: number;
    stocksLeft: number;
    teamId: 0 | 1 | null;
    kingScore: number;
    mechsTriggered: number;
    placement: number;
  }>;
}

export interface TutorialCheckItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TutorialStepSnapshot {
  mode: TutorialMode;
  stepIndex: number;
  totalSteps: number;
  levelNumber: number;
  totalLevels: number;
  levelId?: string;
  tier?: TutorialTier;
  category?: string;
  paceLabel?: string;
  paceScale?: number;
  title: string;
  instruction: string;
  hint: string;
  items: TutorialCheckItem[];
  waypointX: number;
  waypointY: number;
  targetMech?: MechId;
  scenarioName?: string;
  failuresOnLevel?: number;
  maxFailsBeforeReroute?: number;
  reteachMode?: boolean;
  reroutedFrom?: {
    levelIndex: number;
    levelNumber: number;
    title: string;
    reason: string;
  } | null;
  targetZone?: {
    x: number;
    y: number;
    w: number;
    h: number;
    label?: string;
  } | null;
  completedLevelIds?: string[];
  completed: boolean;
}

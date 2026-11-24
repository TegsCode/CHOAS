import { createArenaConfig, GAME_MODES, MECH_DEFINITIONS } from './constants.ts';
import type {
  ArenaId,
  GameMode,
  MatchResultSummary,
  MechId,
  SimEvent,
} from './types.ts';

export interface MechPalette {
  id: string;
  mechId: MechId;
  name: string;
  description: string;
  color: string;
  secondaryColor: string;
  sparkColor: string;
  isDefault?: boolean;
}

export type EquippedMechPalettes = Partial<Record<MechId, string>>;

export type DailyMissionKind =
  | 'mech_any'
  | 'mech_specific'
  | 'parry'
  | 'grapple'
  | 'ko'
  | 'match_play'
  | 'match_win'
  | 'arena_play'
  | 'mode_play';

export interface DailyMission {
  id: string;
  slot: 0 | 1 | 2;
  kind: DailyMissionKind;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  targetMechId?: MechId;
  targetArenaId?: ArenaId;
  targetGameMode?: GameMode;
  rewardPaletteId: string;
}

export interface DailyMissionStore {
  dateKey: string;
  missions: DailyMission[];
  unlockedPaletteIds: string[];
  equippedPalettes: EquippedMechPalettes;
  totalCompleted: number;
}

export const MECH_PALETTES: MechPalette[] = [
  // PHANTOM
  {
    id: 'phantom_default',
    mechId: 'phantom',
    name: 'Twilight Ink',
    description: 'Classic dusky violet mist and phase afterimages.',
    color: MECH_DEFINITIONS.phantom.color,
    secondaryColor: MECH_DEFINITIONS.phantom.secondaryColor,
    sparkColor: '#d9b8eb',
    isDefault: true,
  },
  {
    id: 'phantom_sakura',
    mechId: 'phantom',
    name: 'Sakura Mist',
    description: 'Blossom-rose smoke trails and plum afterimages.',
    color: '#e88ca5',
    secondaryColor: '#7d3d54',
    sparkColor: '#ffd4e0',
  },
  {
    id: 'phantom_jade',
    mechId: 'phantom',
    name: 'Spectral Jade',
    description: 'Verdant spirit wisps echoing across the ruins.',
    color: '#63bfa8',
    secondaryColor: '#28594f',
    sparkColor: '#b9f0e0',
  },

  // METEOR
  {
    id: 'meteor_default',
    mechId: 'meteor',
    name: 'Ember Plunge',
    description: 'Scorched tangerine dive flame and cinder ring.',
    color: MECH_DEFINITIONS.meteor.color,
    secondaryColor: MECH_DEFINITIONS.meteor.secondaryColor,
    sparkColor: '#f7c177',
    isDefault: true,
  },
  {
    id: 'meteor_cobalt',
    mechId: 'meteor',
    name: 'Cobalt Starfall',
    description: 'White-hot sky-blue reentry cone and sapphire shockwave.',
    color: '#5898d4',
    secondaryColor: '#254b75',
    sparkColor: '#bde0ff',
  },
  {
    id: 'meteor_crimson',
    mechId: 'meteor',
    name: 'Caldera Magma',
    description: 'Deep volcanic vermilion crust with glowing ember sparks.',
    color: '#d95448',
    secondaryColor: '#591c1e',
    sparkColor: '#f5a87a',
  },

  // THUNDERBOLT
  {
    id: 'thunderbolt_default',
    mechId: 'thunderbolt',
    name: 'Storm Azure',
    description: 'Crackling raincloud arcs and teal-steel pulse.',
    color: MECH_DEFINITIONS.thunderbolt.color,
    secondaryColor: MECH_DEFINITIONS.thunderbolt.secondaryColor,
    sparkColor: '#b7e6fa',
    isDefault: true,
  },
  {
    id: 'thunderbolt_gold',
    mechId: 'thunderbolt',
    name: 'Solar Arc',
    description: 'Gilded harvest lightning bolts and amber charge.',
    color: '#f2be5c',
    secondaryColor: '#8f5b1e',
    sparkColor: '#fff0b3',
  },
  {
    id: 'thunderbolt_copper',
    mechId: 'thunderbolt',
    name: 'Copper Gale',
    description: 'Burnished foundry sparks and terracotta thunder.',
    color: '#df7c52',
    secondaryColor: '#6e3422',
    sparkColor: '#ffd0b0',
  },

  // SPIDER
  {
    id: 'spider_default',
    mechId: 'spider',
    name: 'Canopy Silk',
    description: 'Forest moss grapple rings and crisp leaf bursts.',
    color: MECH_DEFINITIONS.spider.color,
    secondaryColor: MECH_DEFINITIONS.spider.secondaryColor,
    sparkColor: '#b3e3cb',
    isDefault: true,
  },
  {
    id: 'spider_crimson',
    mechId: 'spider',
    name: 'Widow Thread',
    description: 'Scarlet silk bands and dark-ink wall launches.',
    color: '#d95d43',
    secondaryColor: '#6e241b',
    sparkColor: '#ffb5a6',
  },
  {
    id: 'spider_sprout',
    mechId: 'spider',
    name: 'Sunlit Vine',
    description: 'Warm meadow chartreuse aura and spring pollen.',
    color: '#8fc474',
    secondaryColor: '#385c2f',
    sparkColor: '#e0f7c8',
  },

  // COMET
  {
    id: 'comet_default',
    mechId: 'comet',
    name: 'Gilded Trail',
    description: 'Ochre-gold swing comet and warm sunlit rings.',
    color: MECH_DEFINITIONS.comet.color,
    secondaryColor: MECH_DEFINITIONS.comet.secondaryColor,
    sparkColor: '#fff0bd',
    isDefault: true,
  },
  {
    id: 'comet_rose',
    mechId: 'comet',
    name: 'Rose Quartz',
    description: 'Painted coral-rose meteor streaks and dusty plum glow.',
    color: '#e68a9c',
    secondaryColor: '#80364c',
    sparkColor: '#ffdbe3',
  },
  {
    id: 'comet_indigo',
    mechId: 'comet',
    name: 'Dusk Astral',
    description: 'Twilight periwinkle tail with starlight sparkles.',
    color: '#7a8ce0',
    secondaryColor: '#323d73',
    sparkColor: '#d4dcff',
  },

  // BULLDOZER
  {
    id: 'bulldozer_default',
    mechId: 'bulldozer',
    name: 'Rust Ram',
    description: 'Forged iron-orange prow and heavy impact dust.',
    color: MECH_DEFINITIONS.bulldozer.color,
    secondaryColor: MECH_DEFINITIONS.bulldozer.secondaryColor,
    sparkColor: '#f7c18d',
    isDefault: true,
  },
  {
    id: 'bulldozer_brass',
    mechId: 'bulldozer',
    name: 'Brass Engine',
    description: 'Polished antique brass ramming crest and gold sparks.',
    color: '#e8a848',
    secondaryColor: '#70491a',
    sparkColor: '#ffe7ad',
  },
  {
    id: 'bulldozer_slate',
    mechId: 'bulldozer',
    name: 'Iron Bastion',
    description: 'Tempered steel-blue plating and cold forge sparks.',
    color: '#8ea4b8',
    secondaryColor: '#324152',
    sparkColor: '#dbe9f5',
  },
];

export const UNLOCKABLE_MECH_PALETTES = MECH_PALETTES.filter((p) => !p.isDefault);

export function getPaletteById(paletteId: string | undefined): MechPalette | null {
  if (!paletteId) return null;
  return MECH_PALETTES.find((p) => p.id === paletteId) ?? null;
}

export function getPalettesForMech(mechId: MechId): MechPalette[] {
  return MECH_PALETTES.filter((p) => p.mechId === mechId);
}

export function resolveMechColors(
  mechId: MechId,
  equipped?: EquippedMechPalettes
): {
  paletteId: string;
  paletteName: string;
  color: string;
  secondaryColor: string;
  sparkColor: string;
} {
  const customId = equipped?.[mechId];
  const pal =
    (customId ? MECH_PALETTES.find((p) => p.id === customId && p.mechId === mechId) : null) ??
    MECH_PALETTES.find((p) => p.mechId === mechId && p.isDefault);

  if (pal) {
    return {
      paletteId: pal.id,
      paletteName: pal.name,
      color: pal.color,
      secondaryColor: pal.secondaryColor,
      sparkColor: pal.sparkColor,
    };
  }
  const def = MECH_DEFINITIONS[mechId];
  return {
    paletteId: `${mechId}_default`,
    paletteName: 'Classic Ink',
    color: def.color,
    secondaryColor: def.secondaryColor,
    sparkColor: def.color,
  };
}

export function getLocalDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getResetCountdownLabel(now: Date = new Date()): string {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalMins = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

interface MissionTemplate {
  slot: 0 | 1 | 2;
  kind: DailyMissionKind;
  title: string;
  description: string;
  target: number;
  targetMechId?: MechId;
  targetArenaId?: ArenaId;
  targetGameMode?: GameMode;
}

const SLOT_0_TEMPLATES: Array<(rng: () => number) => MissionTemplate> = [
  () => ({
    slot: 0,
    kind: 'grapple',
    title: 'Hook & Swing',
    description: 'Attach 4 Grappling Hooks to platforms, ceilings, or rivals.',
    target: 4,
  }),
  () => ({
    slot: 0,
    kind: 'parry',
    title: 'Iron Timing',
    description: 'Land 2 timed Parries right as an opponent strikes.',
    target: 2,
  }),
  () => ({
    slot: 0,
    kind: 'mech_any',
    title: 'Fluid Flow',
    description: 'Activate any 3 Mech combos during matches or Crucible drills.',
    target: 3,
  }),
];

const SLOT_1_TEMPLATES: Array<(rng: () => number) => MissionTemplate> = [
  (rng) => {
    const mechs: MechId[] = ['phantom', 'meteor', 'thunderbolt', 'spider', 'comet', 'bulldozer'];
    const mechId = pick(mechs, rng);
    const def = MECH_DEFINITIONS[mechId];
    return {
      slot: 1,
      kind: 'mech_specific',
      targetMechId: mechId,
      title: `${def.name} Specialist`,
      description: `Trigger ${def.name} (${def.sequence.map((s) => s.replace('_', ' ')).join(' → ')}) twice.`,
      target: 2,
    };
  },
  () => ({
    slot: 1,
    kind: 'ko',
    title: 'Ring-Out Ace',
    description: 'Score 3 KOs against opponents in Live Arena matches.',
    target: 3,
  }),
];

const SLOT_2_TEMPLATES: Array<(rng: () => number) => MissionTemplate> = [
  (rng) => {
    const arenas: ArenaId[] = ['meadow', 'canopy', 'islands', 'factory', 'furnace'];
    const arenaId = pick(arenas, rng);
    const arena = createArenaConfig(arenaId);
    return {
      slot: 2,
      kind: 'arena_play',
      targetArenaId: arenaId,
      title: `${arena.name} Expedition`,
      description: `Finish 2 Live Arena matches on ${arena.name}.`,
      target: 2,
    };
  },
  (rng) => {
    const modes: GameMode[] = ['stock_brawl', 'team_chaos', 'king_of_platform'];
    const modeId = pick(modes, rng);
    const mode = GAME_MODES.find((m) => m.id === modeId) ?? GAME_MODES[1];
    return {
      slot: 2,
      kind: 'mode_play',
      targetGameMode: modeId,
      title: `${mode.shortName} Contender`,
      description: `Complete 2 matches in ${mode.name}.`,
      target: 2,
    };
  },
  () => ({
    slot: 2,
    kind: 'match_win',
    title: 'Arena Crown',
    description: 'Claim 1 victory in any Live Arena match mode.',
    target: 1,
  }),
];

function chooseRewardPalettes(
  rng: () => number,
  unlockedIds: string[],
  templates: MissionTemplate[]
): string[] {
  const unlockedSet = new Set(unlockedIds);
  const chosen: string[] = [];
  const used = new Set<string>();

  for (const tpl of templates) {
    // Prefer a locked palette for the mission's targetMechId if present, else any locked palette
    const matchingMechLocked = tpl.targetMechId
      ? UNLOCKABLE_MECH_PALETTES.filter(
          (p) => p.mechId === tpl.targetMechId && !unlockedSet.has(p.id) && !used.has(p.id)
        )
      : [];
    const anyLocked = UNLOCKABLE_MECH_PALETTES.filter(
      (p) => !unlockedSet.has(p.id) && !used.has(p.id)
    );
    const fallbackPool = UNLOCKABLE_MECH_PALETTES.filter((p) => !used.has(p.id));

    const pool =
      matchingMechLocked.length > 0
        ? matchingMechLocked
        : anyLocked.length > 0
          ? anyLocked
          : fallbackPool;

    const picked = pool[Math.floor(rng() * pool.length) % pool.length];
    chosen.push(picked.id);
    used.add(picked.id);
  }

  return chosen;
}

export function getDailyMissions(
  dateKey: string,
  unlockedPaletteIds: string[] = []
): DailyMission[] {
  const rng = mulberry32(hashSeed(`chaos_daily_v1:${dateKey}`));

  const t0 = pick(SLOT_0_TEMPLATES, rng)(rng);
  const t1 = pick(SLOT_1_TEMPLATES, rng)(rng);
  const t2 = pick(SLOT_2_TEMPLATES, rng)(rng);
  const templates = [t0, t1, t2];

  const rewards = chooseRewardPalettes(rng, unlockedPaletteIds, templates);

  return templates.map((tpl, idx) => ({
    ...tpl,
    id: `${dateKey}:slot${idx}:${tpl.kind}`,
    progress: 0,
    completed: false,
    claimed: false,
    rewardPaletteId: rewards[idx],
  }));
}

export function createInitialMissionStore(
  dateKey: string = getLocalDateKey(),
  preserved?: Partial<Pick<DailyMissionStore, 'unlockedPaletteIds' | 'equippedPalettes' | 'totalCompleted'>>
): DailyMissionStore {
  const unlocked = Array.from(new Set(preserved?.unlockedPaletteIds ?? []));
  const equipped: EquippedMechPalettes = {};
  if (preserved?.equippedPalettes) {
    for (const [k, v] of Object.entries(preserved.equippedPalettes) as Array<[MechId, string]>) {
      const pal = getPaletteById(v);
      if (pal && pal.mechId === k && (pal.isDefault || unlocked.includes(pal.id))) {
        equipped[k] = v;
      }
    }
  }
  return {
    dateKey,
    missions: getDailyMissions(dateKey, unlocked),
    unlockedPaletteIds: unlocked,
    equippedPalettes: equipped,
    totalCompleted: preserved?.totalCompleted ?? 0,
  };
}

export function ensureDailyMissionStore(
  store: DailyMissionStore | null | undefined,
  dateKey: string = getLocalDateKey()
): DailyMissionStore {
  if (!store || typeof store !== 'object') {
    return createInitialMissionStore(dateKey);
  }
  if (store.dateKey !== dateKey || !Array.isArray(store.missions) || store.missions.length !== 3) {
    return createInitialMissionStore(dateKey, {
      unlockedPaletteIds: store.unlockedPaletteIds,
      equippedPalettes: store.equippedPalettes,
      totalCompleted: store.totalCompleted,
    });
  }
  return store;
}

export function applySimEventsToMissions(
  store: DailyMissionStore,
  events: SimEvent[],
  humanFighterIds: number[],
  isTutorial: boolean
): { store: DailyMissionStore; newlyCompleted: DailyMission[] } {
  if (events.length === 0 || humanFighterIds.length === 0) {
    return { store, newlyCompleted: [] };
  }
  const humanSet = new Set(humanFighterIds);
  let changed = false;
  const newlyCompleted: DailyMission[] = [];

  const nextMissions = store.missions.map((m) => {
    if (m.completed) return m;
    let delta = 0;
    for (const ev of events) {
      if (m.kind === 'grapple' && ev.type === 'grapple_attach' && ev.fighterId !== undefined && humanSet.has(ev.fighterId)) {
        delta += 1;
      } else if (m.kind === 'parry' && ev.type === 'parry' && ev.fighterId !== undefined && humanSet.has(ev.fighterId)) {
        delta += 1;
      } else if (m.kind === 'mech_any' && ev.type === 'mech_trigger' && ev.fighterId !== undefined && humanSet.has(ev.fighterId)) {
        delta += 1;
      } else if (
        m.kind === 'mech_specific' &&
        ev.type === 'mech_trigger' &&
        ev.mechId === m.targetMechId &&
        ev.fighterId !== undefined &&
        humanSet.has(ev.fighterId)
      ) {
        delta += 1;
      } else if (
        !isTutorial &&
        m.kind === 'ko' &&
        ev.type === 'ko' &&
        ev.targetId !== undefined &&
        humanSet.has(ev.targetId)
      ) {
        delta += 1;
      }
    }
    if (delta === 0) return m;
    changed = true;
    const progress = Math.min(m.target, m.progress + delta);
    const completed = progress >= m.target;
    const updated = { ...m, progress, completed };
    if (completed) newlyCompleted.push(updated);
    return updated;
  });

  if (!changed) return { store, newlyCompleted: [] };
  return {
    store: { ...store, missions: nextMissions },
    newlyCompleted,
  };
}

export function applyMatchResultToMissions(
  store: DailyMissionStore,
  result: MatchResultSummary,
  arenaId: ArenaId
): { store: DailyMissionStore; newlyCompleted: DailyMission[] } {
  let changed = false;
  const newlyCompleted: DailyMission[] = [];

  const nextMissions = store.missions.map((m) => {
    if (m.completed) return m;
    let delta = 0;
    if (m.kind === 'match_play') {
      delta = 1;
    } else if (m.kind === 'match_win' && result.humanWon) {
      delta = 1;
    } else if (m.kind === 'arena_play' && m.targetArenaId === arenaId) {
      delta = 1;
    } else if (m.kind === 'mode_play' && m.targetGameMode === result.gameMode) {
      delta = 1;
    }

    if (delta === 0) return m;
    changed = true;
    const progress = Math.min(m.target, m.progress + delta);
    const completed = progress >= m.target;
    const updated = { ...m, progress, completed };
    if (completed) newlyCompleted.push(updated);
    return updated;
  });

  if (!changed) return { store, newlyCompleted: [] };
  return {
    store: { ...store, missions: nextMissions },
    newlyCompleted,
  };
}

export function claimMissionReward(
  store: DailyMissionStore,
  missionId: string,
  autoEquip = true
): { store: DailyMissionStore; unlockedPalette: MechPalette | null } {
  const target = store.missions.find((m) => m.id === missionId);
  if (!target || !target.completed || target.claimed) {
    return { store, unlockedPalette: null };
  }

  const pal = getPaletteById(target.rewardPaletteId);
  const nextUnlocked = pal && !store.unlockedPaletteIds.includes(pal.id)
    ? [...store.unlockedPaletteIds, pal.id]
    : store.unlockedPaletteIds;

  const nextEquipped = { ...store.equippedPalettes };
  if (autoEquip && pal) {
    nextEquipped[pal.mechId] = pal.id;
  }

  const nextMissions = store.missions.map((m) =>
    m.id === missionId ? { ...m, claimed: true } : m
  );

  return {
    store: {
      ...store,
      missions: nextMissions,
      unlockedPaletteIds: nextUnlocked,
      equippedPalettes: nextEquipped,
      totalCompleted: store.totalCompleted + 1,
    },
    unlockedPalette: pal,
  };
}

export function equipMechPalette(
  store: DailyMissionStore,
  mechId: MechId,
  paletteId: string
): DailyMissionStore {
  const pal = getPaletteById(paletteId);
  if (!pal || pal.mechId !== mechId) return store;
  if (!pal.isDefault && !store.unlockedPaletteIds.includes(pal.id)) {
    return store;
  }

  const nextEquipped = { ...store.equippedPalettes };
  if (pal.isDefault) {
    delete nextEquipped[mechId];
  } else {
    nextEquipped[mechId] = pal.id;
  }
  return {
    ...store,
    equippedPalettes: nextEquipped,
  };
}

const MISSIONS_STORAGE_KEY = 'chaos_daily_missions_v1';

export function loadDailyMissionStore(dateKey: string = getLocalDateKey()): DailyMissionStore {
  if (typeof window === 'undefined') return createInitialMissionStore(dateKey);
  try {
    const raw = window.localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (!raw) return createInitialMissionStore(dateKey);
    const parsed = JSON.parse(raw) as DailyMissionStore;
    return ensureDailyMissionStore(parsed, dateKey);
  } catch {
    return createInitialMissionStore(dateKey);
  }
}

export function saveDailyMissionStore(store: DailyMissionStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

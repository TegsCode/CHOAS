import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMatchResultToMissions,
  applySimEventsToMissions,
  claimMissionReward,
  createInitialMissionStore,
  ensureDailyMissionStore,
  equipMechPalette,
  getDailyMissions,
  getLocalDateKey,
  MECH_PALETTES,
  resolveMechColors,
  UNLOCKABLE_MECH_PALETTES,
} from './missions.ts';
import type { MatchResultSummary } from './types.ts';

test('getDailyMissions deterministically generates 3 distinct daily missions with unique palette rewards', () => {
  const m1 = getDailyMissions('2026-11-24');
  const m2 = getDailyMissions('2026-11-24');
  const mOther = getDailyMissions('2026-11-25');

  assert.equal(m1.length, 3);
  assert.deepEqual(m1, m2);
  assert.notEqual(
    m1.map((m) => m.id).join('|'),
    mOther.map((m) => m.id).join('|')
  );

  const rewardIds = new Set(m1.map((m) => m.rewardPaletteId));
  assert.equal(rewardIds.size, 3, 'Each daily mission rewards a distinct palette');
  for (const rId of rewardIds) {
    assert.ok(UNLOCKABLE_MECH_PALETTES.some((p) => p.id === rId));
  }
});

test('applySimEventsToMissions attributes human events accurately and ignores CPU-only events', () => {
  let store = createInitialMissionStore('2026-11-24');
  store = {
    ...store,
    missions: [
      {
        id: 'test:0',
        slot: 0,
        kind: 'grapple',
        title: 'Hook & Swing',
        description: 'Attach 2 hooks',
        target: 2,
        progress: 0,
        completed: false,
        claimed: false,
        rewardPaletteId: 'phantom_sakura',
      },
      {
        id: 'test:1',
        slot: 1,
        kind: 'mech_specific',
        targetMechId: 'meteor',
        title: 'Meteor Specialist',
        description: 'Trigger Meteor twice',
        target: 2,
        progress: 0,
        completed: false,
        claimed: false,
        rewardPaletteId: 'meteor_cobalt',
      },
      {
        id: 'test:2',
        slot: 2,
        kind: 'ko',
        title: 'Ring-Out Ace',
        description: 'Score 1 KO',
        target: 1,
        progress: 0,
        completed: false,
        claimed: false,
        rewardPaletteId: 'comet_rose',
      },
    ],
  };

  // CPU event (fighterId: 2, targetId: 3) should NOT increment human missions
  const cpuRes = applySimEventsToMissions(
    store,
    [
      { type: 'grapple_attach', x: 0, y: 2, fighterId: 2 },
      { type: 'mech_trigger', x: 0, y: 2, fighterId: 2, mechId: 'meteor' },
      { type: 'ko', x: 20, y: 0, fighterId: 3, targetId: 2 },
    ],
    [0],
    false
  );
  assert.equal(cpuRes.store.missions[0].progress, 0);
  assert.equal(cpuRes.store.missions[1].progress, 0);
  assert.equal(cpuRes.store.missions[2].progress, 0);

  // Human events (fighterId: 0, targetId: 0) increment & complete missions
  const humanRes = applySimEventsToMissions(
    cpuRes.store,
    [
      { type: 'grapple_attach', x: 0, y: 2, fighterId: 0 },
      { type: 'grapple_attach', x: 1, y: 2, fighterId: 0 },
      { type: 'mech_trigger', x: 0, y: 3, fighterId: 0, mechId: 'meteor' },
      { type: 'ko', x: 20, y: 0, fighterId: 2, targetId: 0 },
    ],
    [0],
    false
  );

  assert.equal(humanRes.store.missions[0].progress, 2);
  assert.equal(humanRes.store.missions[0].completed, true);
  assert.equal(humanRes.store.missions[1].progress, 1);
  assert.equal(humanRes.store.missions[1].completed, false);
  assert.equal(humanRes.store.missions[2].progress, 1);
  assert.equal(humanRes.store.missions[2].completed, true);
  assert.equal(humanRes.newlyCompleted.length, 2);
});

test('applyMatchResultToMissions completes match_win and arena_play missions', () => {
  let store = createInitialMissionStore('2026-11-24');
  store = {
    ...store,
    missions: [
      {
        id: 'm:win',
        slot: 2,
        kind: 'match_win',
        title: 'Arena Crown',
        description: 'Win 1 match',
        target: 1,
        progress: 0,
        completed: false,
        claimed: false,
        rewardPaletteId: 'thunderbolt_gold',
      },
      {
        id: 'm:arena',
        slot: 1,
        kind: 'arena_play',
        targetArenaId: 'meadow',
        title: 'Overworld',
        description: 'Play 2 on Overworld',
        target: 2,
        progress: 1,
        completed: false,
        claimed: false,
        rewardPaletteId: 'spider_sprout',
      },
      {
        id: 'm:mode',
        slot: 0,
        kind: 'mode_play',
        targetGameMode: 'king_of_platform',
        title: 'King Crown',
        description: 'Play King Crown',
        target: 2,
        progress: 0,
        completed: false,
        claimed: false,
        rewardPaletteId: 'bulldozer_brass',
      },
    ],
  };

  const result: MatchResultSummary = {
    gameMode: 'king_of_platform',
    winnerId: 0,
    winningTeam: null,
    winnerName: 'P1 · Ashka',
    winnerColor: '#c94c4c',
    humanWon: true,
    humanPlacement: 1,
    totalFighters: 4,
    durationSeconds: 45,
    humanKos: 2,
    humanMechs: 3,
    arenaName: 'Sunlit Overworld',
    standings: [],
  };

  const out = applyMatchResultToMissions(store, result, 'meadow');
  assert.equal(out.store.missions[0].completed, true);
  assert.equal(out.store.missions[1].completed, true);
  assert.equal(out.store.missions[2].progress, 1);
  assert.equal(out.newlyCompleted.length, 2);
});

test('claimMissionReward unlocks & equips palette, equipMechPalette rejects locked palettes, and day rollover preserves unlocks', () => {
  let store = createInitialMissionStore('2026-11-24');
  store = {
    ...store,
    missions: [
      {
        ...store.missions[0],
        progress: store.missions[0].target,
        completed: true,
        rewardPaletteId: 'phantom_sakura',
      },
      store.missions[1],
      store.missions[2],
    ],
  };

  // Reject equipping a locked palette
  const rejected = equipMechPalette(store, 'meteor', 'meteor_cobalt');
  assert.equal(rejected.equippedPalettes.meteor, undefined);

  // Claim completed mission -> unlocks + equips phantom_sakura
  const claimed = claimMissionReward(store, store.missions[0].id, true);
  assert.equal(claimed.unlockedPalette?.id, 'phantom_sakura');
  assert.ok(claimed.store.unlockedPaletteIds.includes('phantom_sakura'));
  assert.equal(claimed.store.equippedPalettes.phantom, 'phantom_sakura');
  assert.equal(claimed.store.totalCompleted, 1);

  const resolved = resolveMechColors('phantom', claimed.store.equippedPalettes);
  const sakura = MECH_PALETTES.find((p) => p.id === 'phantom_sakura')!;
  assert.equal(resolved.color, sakura.color);
  assert.equal(resolved.secondaryColor, sakura.secondaryColor);

  // Day rollover generates fresh missions for new date while preserving unlocks & equipped palettes
  const nextDay = ensureDailyMissionStore(claimed.store, '2026-11-25');
  assert.equal(nextDay.dateKey, '2026-11-25');
  assert.equal(nextDay.missions[0].progress, 0);
  assert.ok(nextDay.unlockedPaletteIds.includes('phantom_sakura'));
  assert.equal(nextDay.equippedPalettes.phantom, 'phantom_sakura');
  assert.equal(nextDay.totalCompleted, 1);
  assert.match(getLocalDateKey(new Date(2026, 10, 24)), /^2026-11-24$/);
});

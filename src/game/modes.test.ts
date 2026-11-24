import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArenaConfig,
  getControlBindings,
  PLAYABLE_ARENAS,
} from './constants.ts';
import {
  buildMatchResult,
  createSimulation,
  EMPTY_INPUT,
  stepSimulation,
} from './physics.ts';
import { ReplayRecorder } from './replay.ts';

test('new meadow (Overworld) and canopy (Toadstool) arenas build valid platforms, anchors, and kingZones', () => {
  assert.ok(PLAYABLE_ARENAS.includes('meadow'));
  assert.ok(PLAYABLE_ARENAS.includes('canopy'));

  for (const id of ['meadow', 'canopy'] as const) {
    const cfg = createArenaConfig(id);
    assert.ok(cfg.platforms.length >= 6, `${id} should have >=6 platforms`);
    assert.ok(cfg.anchors.length >= 2, `${id} should have >=2 grapple anchors`);
    assert.ok((cfg.kingZones?.length ?? 0) >= 3, `${id} should have >=3 kingZones`);
    assert.ok(cfg.spawnPoints.length >= 8, `${id} should support 8P spawns`);
  }
});

test('stock_brawl respawns fallen fighters with spawnInvulnTimer until stocks run out', () => {
  const sim = createSimulation({
    arenaId: 'meadow',
    gameMode: 'stock_brawl',
    fighterCount: 2,
    p1ArchetypeId: 'ember',
  });
  const [p1, bot] = sim.fighters;
  assert.equal(p1.stocks, 3);
  assert.equal(bot.stocks, 3);

  // Drop bot below blast boundary
  bot.y = sim.blastBounds.bottom - 3;
  stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });

  assert.equal(bot.alive, false);
  assert.equal(bot.stocks, 2);
  assert.ok(bot.respawnTimer > 1.0);
  assert.equal(sim.matchFinished, false);

  // Step through 2.2s until bot respawns with spawn invulnerability
  for (let i = 0; i < 135; i++) {
    stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  }
  assert.equal(bot.alive, true);
  assert.ok(bot.spawnInvulnTimer > 0.2);

  // Exhaust remaining 2 stocks -> match finishes after finishDelayTimer
  bot.stocks = 1;
  bot.spawnInvulnTimer = 0;
  bot.y = sim.blastBounds.bottom - 3;
  for (let i = 0; i < 32; i++) {
    stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  }
  assert.equal(bot.stocks, 0);
  assert.equal(sim.matchFinished, true);
  const res = buildMatchResult(sim, 'Sunlit Overworld');
  assert.equal(res.humanWon, true);
  assert.equal(res.gameMode, 'stock_brawl');
});

test('team_chaos blocks friendly fire between same-team fighters and resolves winning team', () => {
  const sim = createSimulation({
    arenaId: 'canopy',
    gameMode: 'team_chaos',
    fighterCount: 4,
    p1ArchetypeId: 'ember',
  });
  const team0 = sim.fighters.filter((f) => f.teamId === 0);
  const team1 = sim.fighters.filter((f) => f.teamId === 1);
  assert.equal(team0.length, 2);
  assert.equal(team1.length, 2);

  // Put two Team 0 allies side-by-side and trigger an attack from ally A
  const [allyA, allyB] = team0;
  allyA.x = 0;
  allyA.y = 2;
  allyA.facing = 1;
  allyB.x = 0.8;
  allyB.y = 2;
  allyB.damagePercent = 0;

  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, attackPressed: true },
  });
  for (let i = 0; i < 8; i++) {
    stepSimulation(sim, 1 / 60, {});
  }
  assert.equal(allyB.damagePercent, 0, 'Teammates must not take friendly fire');

  // Eliminate Team 1 -> Team 0 wins after finishDelayTimer
  for (const enemy of team1) {
    enemy.alive = false;
    enemy.stocks = 0;
    enemy.respawnTimer = 0;
  }
  for (let i = 0; i < 32; i++) {
    stepSimulation(sim, 1 / 60, {});
  }
  assert.equal(sim.matchFinished, true);
  assert.equal(sim.winningTeam, 0);
  const res = buildMatchResult(sim, 'Toadstool Glade');
  assert.equal(res.winningTeam, 0);
  assert.equal(res.humanWon, true);
});

test('king_of_platform scores when uncontested inside kingZone and freezes when contested', () => {
  const sim = createSimulation({
    arenaId: 'meadow',
    gameMode: 'king_of_platform',
    fighterCount: 2,
    p1ArchetypeId: 'ember',
  });
  assert.ok(sim.kingZone !== null);
  const zone = sim.kingZone!;
  const [p1, bot] = sim.fighters;

  // Move P1 into zone, bot outside
  p1.x = zone.x;
  p1.y = zone.y;
  p1.vx = 0;
  p1.vy = 0;
  bot.x = zone.x + 12;
  bot.y = 2;

  for (let i = 0; i < 60; i++) {
    stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  }
  const soloScore = p1.kingScore;
  assert.ok(soloScore > 4.0, `Expected kingScore > 4 after 1s uncontested, got ${soloScore}`);

  // Move bot into zone -> contested, score pauses
  bot.x = zone.x + 0.5;
  bot.y = zone.y;
  bot.vx = 0;
  bot.vy = 0;
  stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  assert.equal(sim.kingZone?.contested, true);

  // Reach 100% -> King of the Platform victory
  p1.kingScore = 99.9;
  bot.x = zone.x + 12;
  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  }
  assert.equal(sim.matchFinished, true);
  assert.equal(sim.winnerId, p1.id);
});

test('ReplayRecorder records 30fps circular frames and finds KO climax start ~2.8s prior', () => {
  const sim = createSimulation({
    arenaId: 'meadow',
    gameMode: 'last_standing',
    fighterCount: 2,
    p1ArchetypeId: 'ember',
  });
  const recorder = new ReplayRecorder(150);

  for (let i = 0; i < 180; i++) {
    // 3 seconds at 60Hz -> 90 recorded frames
    stepSimulation(sim, 1 / 60, {});
    if (i === 170) {
      sim.events.push({ type: 'ko', x: 0, y: 0, fighterId: 1 });
    }
    recorder.recordStep(sim);
  }

  assert.ok(recorder.hasFrames());
  assert.equal(recorder.getKoTimes().length, 1);
  const startIdx = recorder.findBestKoReplayStart();
  const frames = recorder.getFrames();
  assert.ok(startIdx >= 0 && startIdx < frames.length);
  const startElapsed = frames[startIdx].elapsed;
  const koElapsed = recorder.getKoTimes()[0];
  assert.ok(koElapsed - startElapsed <= 3.1 && koElapsed - startElapsed >= 2.0);
});

test('getControlBindings separates P1 left-handed keys from P2 when p2Enabled is true', () => {
  const left2p = getControlBindings('left', true);
  assert.equal(left2p.move, 'J / L');
  assert.ok(left2p.compactLine.includes('P2:'));
});

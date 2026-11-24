import test from 'node:test';
import assert from 'node:assert/strict';
import { ACADEMY_LEVELS } from './academyLevels';
import { createSimulation, EMPTY_INPUT, stepSimulation } from './physics';
import {
  createTutorialRunner,
  generateProceduralCrucibleScenario,
  getTutorialSnapshot,
  jumpRunnerToLevel,
  updateTutorialRunner,
} from './tutorial';
import { PlayerInput } from './types';

function makeInput(partial: Partial<PlayerInput>): PlayerInput {
  return { ...EMPTY_INPUT, ...partial };
}

test('tutorial simulation spawns P1 and Sparring Dummy on Proving Grounds and never terminates match early', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 6,
    p1ArchetypeId: 'ember',
    tutorial: true,
  });

  assert.equal(sim.arenaId, 'tutorial');
  assert.equal(sim.isTutorial, true);
  assert.equal(sim.fighters.length, 2);
  assert.equal(sim.fighters[0].isHuman, true);
  assert.equal(sim.fighters[1].isHuman, false);
  assert.equal(sim.fighters[1].name, 'Sparring Dummy');

  for (let i = 0; i < 40; i++) {
    stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  }
  assert.equal(sim.matchFinished, false);
  assert.equal(sim.fighters[0].alive, true);
  assert.equal(sim.fighters[1].alive, true);
});

test('tutorial safety respawn emits tutorial_fall, keeps human alive, and respawns dummy after KO', () => {
  const sim = createSimulation({
    arenaId: 'tutorial',
    fighterCount: 2,
    p1ArchetypeId: 'ember',
    tutorial: true,
  });

  sim.fighters[0].y = sim.blastBounds.bottom - 2;
  stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  assert.equal(sim.fighters[0].alive, true);
  assert.ok(sim.fighters[0].y > 0);
  assert.ok(
    sim.events.some((ev) => ev.type === 'tutorial_fall' && ev.fighterId === 0),
    'Out-of-bounds fall in tutorial must emit tutorial_fall event'
  );

  sim.fighters[1].lastHitBy = 0;
  sim.fighters[1].lastHitTime = sim.elapsed;
  sim.fighters[1].x = sim.blastBounds.right + 2;
  stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  assert.equal(sim.fighters[1].alive, false);
  assert.equal(sim.fighters[0].kos, 1);

  for (let i = 0; i < 90; i++) {
    stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
  }
  assert.equal(sim.fighters[1].alive, true);
  assert.equal(sim.matchFinished, false);
});

test('Academy curriculum has 28 chronological levels, slow-to-fast pace scaling, and interleaved Movement I..V', () => {
  assert.ok(ACADEMY_LEVELS.length >= 25, 'Academy must contain at least 25 levels');
  assert.equal(ACADEMY_LEVELS.length, 28);

  // Pace must start noticeably slower (<= 0.78x) and scale up to 1.0x at mastery
  assert.ok(ACADEMY_LEVELS[0].paceScale <= 0.78);
  assert.equal(ACADEMY_LEVELS[ACADEMY_LEVELS.length - 1].paceScale, 1.0);
  for (let i = 1; i < ACADEMY_LEVELS.length; i++) {
    assert.ok(
      ACADEMY_LEVELS[i].paceScale >= ACADEMY_LEVELS[i - 1].paceScale,
      `Level ${i + 1} paceScale must be monotonically non-decreasing`
    );
  }

  // Movement I..V must be interleaved chronologically, NOT clumped back-to-back
  const movIndices = ACADEMY_LEVELS
    .map((lv, idx) => (lv.id.startsWith('mov-') ? idx : -1))
    .filter((idx) => idx >= 0);
  assert.deepEqual(movIndices, [0, 2, 6, 11, 21]);
});

test('Academy progression clears Level 1 (Movement I) and advances cleanly to Level 2', () => {
  const runner = createTutorialRunner('basics', 'right', 1337);
  const ac1 = runner.currentAcademySetup!;
  const sim = createSimulation({
    arenaId: 'tutorial',
    fighterCount: ac1.bots.length + 1,
    p1ArchetypeId: 'ember',
    tutorial: true,
    tutorialMode: 'basics',
    tutorialPaceScale: ac1.paceScale,
    tutorialBotBehavior: ac1.botBehavior,
    tutorialBotAggression: ac1.botAggression,
    tutorialBotHomeX: ac1.botHomeX,
    customArena: ac1.arena,
    customBots: ac1.bots,
  });

  const p1 = sim.fighters[0];
  assert.equal(getTutorialSnapshot(runner).levelNumber, 1);
  assert.equal(getTutorialSnapshot(runner).paceScale, 0.74);

  // 1) Sprint right into the STOP ZONE (4.0..8.0) and brake cleanly, then reverse left (-8.0..-3.5) and brake
  let advanced = false;
  for (let i = 0; i < 360 && !advanced; i++) {
    const sawRightStop = runner.academyProgress.flags.stop_right === true;
    let input = EMPTY_INPUT;
    if (!sawRightStop) {
      input = p1.x >= 5.2 ? EMPTY_INPUT : makeInput({ moveX: 1 });
    } else {
      input = p1.x <= -4.8 ? EMPTY_INPUT : makeInput({ moveX: -1 });
    }
    stepSimulation(sim, 1 / 60, { 0: input });
    const res = updateTutorialRunner(runner, sim, p1, sim.events, 1 / 60, false);
    if (res.stepAdvanced) {
      advanced = true;
      assert.equal(res.snapshot.levelNumber, 2);
      assert.ok(res.nextAcademySetup);
      assert.ok(runner.completedLevelIds.includes('mov-1'));
    }
  }
  assert.equal(advanced, true, 'Player should complete Movement I and advance to Level 2');
});

test('Failure rerouting sends struggling player back to prerequisite in Reteach Mode and returns upon completion', () => {
  const runner = createTutorialRunner('basics', 'right', 2026);
  // Jump to Level 4 (Jumping II: Double Jump, failLimit=2, rerouteToId='mov-2' at index 2)
  const setupLv4 = jumpRunnerToLevel(runner, 3);
  assert.ok(setupLv4);
  assert.equal(getTutorialSnapshot(runner).levelNumber, 4);

  let sim = createSimulation({
    arenaId: 'tutorial',
    fighterCount: setupLv4.bots.length + 1,
    p1ArchetypeId: 'ember',
    tutorial: true,
    tutorialMode: 'basics',
    tutorialPaceScale: setupLv4.paceScale,
    tutorialBotBehavior: setupLv4.botBehavior,
    tutorialBotAggression: setupLv4.botAggression,
    tutorialBotHomeX: setupLv4.botHomeX,
    customArena: setupLv4.arena,
    customBots: setupLv4.bots,
  });

  // Fail once -> stays on Level 4 with failure count = 1
  const resFail1 = updateTutorialRunner(
    runner,
    sim,
    sim.fighters[0],
    [{ type: 'tutorial_fall', x: 0, y: -11, fighterId: 0 }],
    1 / 60,
    false
  );
  assert.equal(resFail1.rerouted, false);
  assert.equal(resFail1.snapshot.levelNumber, 4);
  assert.equal(resFail1.snapshot.failuresOnLevel, 1);

  // Fail twice -> reroutes back to Lv 3 (mov-2) in calmer Reteach Mode!
  const resFail2 = updateTutorialRunner(
    runner,
    sim,
    sim.fighters[0],
    [{ type: 'tutorial_fall', x: 0, y: -11, fighterId: 0 }],
    1 / 60,
    false
  );
  assert.equal(resFail2.rerouted, true);
  assert.equal(resFail2.snapshot.levelNumber, 3);
  assert.equal(resFail2.snapshot.reteachMode, true);
  assert.equal(resFail2.snapshot.reroutedFrom?.levelNumber, 4);
  assert.ok(
    (resFail2.snapshot.paceScale ?? 1) < ACADEMY_LEVELS[2].paceScale,
    'Reteach mode must slow pace below standard level pace'
  );

  // Swap sim to the reteach setup for Level 3 (Movement II: Air Drift)
  const reteachAc = resFail2.nextAcademySetup!;
  sim = createSimulation({
    arenaId: 'tutorial',
    fighterCount: reteachAc.bots.length + 1,
    p1ArchetypeId: 'ember',
    tutorial: true,
    tutorialMode: 'basics',
    tutorialPaceScale: reteachAc.paceScale,
    customArena: reteachAc.arena,
    customBots: reteachAc.bots,
  });

  // Perform midair direction reversal (vx > 2.5 -> vx < -1.8 while airborne) then land on tucked loft (y >= 2.8, x in [-5.6, -0.8])
  sim.fighters[0].grounded = false;
  sim.fighters[0].vx = 3.6;
  updateTutorialRunner(runner, sim, sim.fighters[0], [], 1 / 60, false);
  sim.fighters[0].vx = -2.8;
  updateTutorialRunner(runner, sim, sim.fighters[0], [], 1 / 60, false);

  sim.fighters[0].x = -3.2;
  sim.fighters[0].y = 3.25;
  sim.fighters[0].grounded = true;
  const resReturn = updateTutorialRunner(runner, sim, sim.fighters[0], [], 1 / 60, false);
  assert.equal(resReturn.stepAdvanced, true);
  assert.equal(resReturn.snapshot.levelNumber, 4);
  assert.equal(resReturn.snapshot.reteachMode, false);
  assert.equal(resReturn.snapshot.reroutedFrom, null);
});

test('generateProceduralCrucibleScenario varies layout and enemy placement across seeds', () => {
  const s1 = generateProceduralCrucibleScenario(0, 101, 'meteor');
  const s2 = generateProceduralCrucibleScenario(0, 99999, 'meteor');
  assert.equal(s1.targetMech, 'meteor');
  assert.equal(s2.targetMech, 'meteor');
  assert.ok(s1.bots.length >= 2);
  assert.ok(s1.arena.platforms.length >= 2);
  const diff =
    Math.abs(s1.arena.platforms[0].x - s2.arena.platforms[0].x) +
    Math.abs(s1.arena.platforms[1].y - s2.arena.platforms[1].y) +
    Math.abs(s1.bots[0].x - s2.bots[0].x);
  assert.ok(diff > 0.05, 'Different seeds must produce varied scenario geometry and spawns');
});

test('Crucible tutorial runner progresses across all 5 procedural waves when Mechs are used in combat', () => {
  const runner = createTutorialRunner('crucible', 'left', 4242);
  assert.equal(runner.mode, 'crucible');
  assert.equal(runner.totalSteps, 5);
  assert.ok(runner.currentScenario !== null);

  let sim = createSimulation({
    arenaId: 'crucible',
    fighterCount: 3,
    p1ArchetypeId: 'ember',
    tutorial: true,
    tutorialMode: 'crucible',
    customArena: runner.currentScenario!.arena,
    customBots: runner.currentScenario!.bots,
  });

  const wrongRes = updateTutorialRunner(
    runner,
    sim,
    sim.fighters[0],
    [{ type: 'mech_trigger', x: 0, y: 2, fighterId: 0, mechId: 'phantom' }],
    1 / 60,
    false
  );
  const firstMech = runner.mechOrder[0];
  if (firstMech !== 'phantom') {
    assert.equal(wrongRes.stepAdvanced, false);
  }

  for (let w = 0; w < 5; w++) {
    const targetMech = runner.currentScenario!.targetMech;
    const p1 = sim.fighters[0];
    const events: Parameters<typeof updateTutorialRunner>[3] = [
      { type: 'mech_trigger', x: p1.x, y: p1.y, fighterId: 0, mechId: targetMech },
      { type: 'attack_hit', x: p1.x, y: p1.y, fighterId: 0, targetId: 1 },
    ];
    const res = updateTutorialRunner(runner, sim, p1, events, 1 / 60, false);
    if (w < 4) {
      assert.equal(res.stepAdvanced, true, `Wave ${w} should advance`);
      assert.ok(res.nextCrucibleScenario, `Wave ${w} should emit next procedural scenario`);
      sim = createSimulation({
        arenaId: 'crucible',
        fighterCount: res.nextCrucibleScenario!.bots.length + 1,
        p1ArchetypeId: 'ember',
        tutorial: true,
        tutorialMode: 'crucible',
        customArena: res.nextCrucibleScenario!.arena,
        customBots: res.nextCrucibleScenario!.bots,
      });
    } else {
      assert.equal(res.justCompleted, true, 'Wave 5 should complete Crucible');
      assert.equal(res.snapshot.completed, true);
    }
  }
});

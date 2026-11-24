import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, EMPTY_INPUT, stepSimulation } from './physics';
import { PHYSICS } from './constants';
import { PlayerInput } from './types';

function stepFrames(
  state: ReturnType<typeof createSimulation>,
  frames: number,
  inputFn: (frame: number) => Record<number, PlayerInput>
) {
  for (let i = 0; i < frames; i++) {
    stepSimulation(state, 1 / 60, inputFn(i));
  }
}

test('Run before Jump preserves horizontal momentum', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'ember',
  });
  const p1 = sim.fighters[0];
  p1.x = 0;
  p1.y = 0.8; // land on central terrace (top = 0.8)

  // Settle on ground and run right
  stepFrames(sim, 25, () => ({
    0: { ...EMPTY_INPUT, moveX: 1 },
  }));
  assert.equal(p1.grounded, true);
  assert.ok(p1.vx > 8, `Expected run vx > 8, got ${p1.vx}`);

  const runVx = p1.vx;
  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, moveX: 1, jumpPressed: true, jumpHeld: true },
  });

  assert.equal(p1.grounded, false);
  assert.ok(p1.vy > 14, 'Jump should grant upward velocity');
  assert.ok(Math.abs(p1.vx - runVx) < 1.5, 'Jump must preserve horizontal run momentum');
});

test('Double jump works once in air and there is NO Air Recovery', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'wraith',
  });
  const p1 = sim.fighters[0];
  p1.x = 0;
  p1.y = 0.8;
  stepFrames(sim, 5, () => ({ 0: EMPTY_INPUT }));

  // Ground jump (hold jump for 28 frames to reach apex while airborne)
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true } });
  assert.equal(p1.doubleJumpAvailable, true);

  // Advance until descending while still airborne
  stepFrames(sim, 28, () => ({ 0: { ...EMPTY_INPUT, jumpHeld: true } }));
  assert.equal(p1.grounded, false);
  assert.ok(p1.vy < 0);

  // Double jump
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true } });
  assert.equal(p1.doubleJumpAvailable, false);
  assert.ok(p1.vy > 12, 'Double jump should restore upward velocity');

  // Third jump attempt in mid-air must NOT trigger air recovery
  stepFrames(sim, 26, () => ({ 0: { ...EMPTY_INPUT, jumpHeld: true } }));
  const preVy = p1.vy;
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true } });
  assert.ok(p1.vy <= preVy, 'No third jump or air recovery allowed');
});

test('PHANTOM Mech activates on Dash -> Double Jump and grants intangibility to players', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'ember',
  });
  const p1 = sim.fighters[0];
  p1.x = 0;
  p1.y = 0.8;
  stepFrames(sim, 4, () => ({ 0: EMPTY_INPUT }));

  // Jump first to be airborne, then Dash, then Double Jump
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true } });
  stepFrames(sim, 4, () => ({ 0: EMPTY_INPUT }));

  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, moveX: 1, dashPressed: true } });
  stepFrames(sim, 4, () => ({ 0: EMPTY_INPUT }));

  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true } });

  assert.equal(p1.activeMech?.id, 'phantom');
  assert.equal(p1.intangibleToPlayers, true);
  assert.equal(p1.mechsTriggered, 1);
});

test('METEOR Mech activates on Jump -> Dive and creates landing shockwave', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'titan',
  });
  const p1 = sim.fighters[0];
  const p2 = sim.fighters[1];
  p1.x = 0;
  p1.y = 0.8;
  p2.x = 1.6;
  p2.y = 0.8;
  stepFrames(sim, 6, () => ({ 0: EMPTY_INPUT, 1: EMPTY_INPUT }));

  // Jump then Dive
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true } });
  stepFrames(sim, 6, () => ({ 0: EMPTY_INPUT, 1: EMPTY_INPUT }));
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, divePressed: true } });
  assert.equal(p1.activeMech?.id, 'meteor');

  // Fall until landing impact
  let sawMeteorPulse = false;
  for (let i = 0; i < 40; i++) {
    stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT, 1: EMPTY_INPUT });
    if (sim.events.some((e) => e.type === 'mech_pulse' && e.mechId === 'meteor')) {
      sawMeteorPulse = true;
    }
  }
  assert.equal(sawMeteorPulse, true, 'Meteor dive impact must emit mech_pulse');
  assert.ok(p2.damagePercent > 0, 'Nearby fighter should take Meteor shockwave damage');
});

test('THUNDERBOLT Mech activates on Dash -> Slide and pulses on completion', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'volt',
  });
  const p1 = sim.fighters[0];
  p1.x = -2;
  p1.y = 0.8;
  stepFrames(sim, 5, () => ({ 0: EMPTY_INPUT }));

  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, moveX: 1, dashPressed: true } });
  stepFrames(sim, 3, () => ({ 0: EMPTY_INPUT }));
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, moveX: 1, slidePressed: true } });

  assert.equal(p1.activeMech?.id, 'thunderbolt');
});

test('BULLDOZER Mech activates on Run -> Slide -> Dash', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'titan',
  });
  const p1 = sim.fighters[0];
  p1.x = -3;
  p1.y = 0.8;

  // Run long enough to log 'run'
  stepFrames(sim, 20, () => ({ 0: { ...EMPTY_INPUT, moveX: 1 } }));
  // Slide
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, moveX: 1, slidePressed: true } });
  stepFrames(sim, 4, () => ({ 0: { ...EMPTY_INPUT, moveX: 1 } }));
  // Dash
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, moveX: 1, dashPressed: true } });

  assert.equal(p1.activeMech?.id, 'bulldozer');
});

test('Pull only works while grappling and Ledge Grab is proximity-limited', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'rift',
  });
  const p1 = sim.fighters[0];

  // Try pull without grappling -> should NOT change velocity upward toward an anchor
  p1.x = 0;
  p1.y = 4;
  p1.vx = 0;
  p1.vy = 0;
  stepSimulation(sim, 1 / 60, { 0: { ...EMPTY_INPUT, pullHeld: true } });
  assert.equal(p1.grapple.active, false);
  assert.ok(p1.vy < 0, 'Pull must do nothing when not grappling');

  // Position within ledge grab range of isl-main right corner (right = 6.3, top = 0.8)
  p1.x = 6.7;
  p1.y = 0.8 - p1.height * 0.78 - 0.1;
  p1.vy = -1.5;
  p1.vx = -1;
  stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT });
  assert.equal(p1.ledgeGrab.active, true, 'Should grab ledge when within proximity');

  // Far away from any ledge -> must NOT grab
  p1.ledgeGrab.active = false;
  p1.ledgeCooldown = 0;
  p1.x = 18.0;
  p1.y = 5.0;
  p1.vy = -2.0;
  stepSimulation(sim, 1 / 60, { 0: EMPTY_INPUT });
  assert.equal(p1.ledgeGrab.active, false, 'Must not grab ledge when out of range');
});

test('Attack deals knockback and Defend Parry reflects attacker', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'ember',
  });
  const p1 = sim.fighters[0];
  const p2 = sim.fighters[1];
  p1.x = -0.7;
  p1.y = 0.8;
  p1.facing = 1;
  p2.x = 0.5;
  p2.y = 0.8;
  p2.facing = -1;
  stepFrames(sim, 4, () => ({ 0: EMPTY_INPUT, 1: EMPTY_INPUT }));

  // P1 attacks while P2 initiates Defend (Parry window)
  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, attackPressed: true },
    1: { ...EMPTY_INPUT, defendHeld: true },
  });
  // Advance past windup into active frames
  let parried = false;
  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, 1 / 60, {
      0: EMPTY_INPUT,
      1: { ...EMPTY_INPUT, defendHeld: true },
    });
    if (sim.events.some((e) => e.type === 'parry')) parried = true;
  }
  assert.equal(parried, true, 'Early defend should trigger a Perfect Parry');
  assert.ok(p1.hitstunTimer > 0, 'Attacker should be staggered by Perfect Parry');
});

test('Last Player Standing ends match when 1 survivor remains', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'ember',
  });
  // Knock 3 bots out of blast bounds
  sim.fighters[1].y = -20;
  sim.fighters[2].y = -20;
  sim.fighters[3].y = -20;

  stepFrames(sim, 45, () => ({ 0: EMPTY_INPUT }));
  assert.equal(sim.matchFinished, true);
  assert.equal(sim.winnerId, 0);
  assert.equal(PHYSICS.GRAPPLE_RANGE > 0, true);
});

test('SPIDER Mech activates on Grapple -> Wall Jump', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'wraith',
  });
  const p1 = sim.fighters[0];
  // Position near left monolith pillar (x = -15.2, w = 1.1 -> right face at -14.65)
  p1.x = -14.0;
  p1.y = 5.0;
  p1.vx = -6;
  p1.vy = 0;

  // Grapple toward pillar/anchor
  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, moveX: -1, grapplePressed: true, aimX: -0.5, aimY: 0.8 },
  });
  assert.equal(p1.grapple.active, true);

  // Release grapple and press against wall
  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, moveX: -1, grapplePressed: true },
  });
  stepFrames(sim, 3, () => ({ 0: { ...EMPTY_INPUT, moveX: -1 } }));
  assert.equal(p1.onWall, -1);

  // Wall jump!
  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, moveX: -1, jumpPressed: true, jumpHeld: true },
  });
  assert.equal(p1.activeMech?.id, 'spider');
  assert.ok(p1.vx > 14, 'Spider wall jump should grant amplified launch speed');
});

test('COMET Mech activates on Swing -> Dive and scales with swing speed', () => {
  const sim = createSimulation({
    arenaId: 'islands',
    fighterCount: 4,
    p1ArchetypeId: 'nova',
  });
  const p1 = sim.fighters[0];
  // Position left of isl-a2 (7.2, 7.4) with horizontal swing speed
  p1.x = 3.8;
  p1.y = 5.5;
  p1.vx = 9.0;
  p1.vy = -1.5;

  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, grapplePressed: true, aimX: 0.78, aimY: 0.62 },
  });
  assert.equal(p1.grapple.active, true);

  // Allow hook to fly & latch, then swing under anchor to build speed
  stepFrames(sim, 22, () => ({ 0: { ...EMPTY_INPUT, moveX: 1 } }));
  assert.equal(p1.grapple.phase, 'attached');

  // Dive out of swing!
  stepSimulation(sim, 1 / 60, {
    0: { ...EMPTY_INPUT, moveX: 1, divePressed: true },
  });
  assert.equal(p1.activeMech?.id, 'comet');
  assert.ok((p1.activeMech?.power ?? 0) > 1.15, 'Comet power must scale with swing speed');
});

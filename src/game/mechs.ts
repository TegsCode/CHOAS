import { MECH_DEFINITIONS, MECH_LIST } from './constants.ts';
import type { ActionStamp, FighterState, MechId, MovementVerb } from './types.ts';

const MAX_HISTORY_AGE = 2.0;

/**
 * Records a movement verb in the fighter's action history and automatically
 * checks if any authored Mech combination has been completed.
 * Returns the triggered MechId if activated, or null.
 */
export function recordMovementVerb(
  fighter: FighterState,
  verb: MovementVerb,
  now: number,
  meta?: number
): MechId | null {
  fighter.actionHistory.push({ verb, time: now, meta });
  // Prune old entries
  while (
    fighter.actionHistory.length > 0 &&
    now - fighter.actionHistory[0].time > MAX_HISTORY_AGE
  ) {
    fighter.actionHistory.shift();
  }

  // Evaluate 3-step Mechs before 2-step Mechs so Bulldozer (run -> slide -> dash) takes priority
  const ordered = [...MECH_LIST].sort((a, b) => b.sequence.length - a.sequence.length);

  for (const def of ordered) {
    if (fighter.mechCooldowns[def.id] > 0) continue;
    if (matchesSequence(fighter.actionHistory, def.sequence, def.windowSeconds, now)) {
      activateMech(fighter, def.id, now, meta);
      return def.id;
    }
  }

  return null;
}

/**
 * Checks whether the end of actionHistory matches `sequence` in order
 * within `windowSeconds`, ending on the just-recorded verb.
 */
export function matchesSequence(
  history: ActionStamp[],
  sequence: MovementVerb[],
  windowSeconds: number,
  now: number
): boolean {
  if (history.length < sequence.length) return false;
  const lastVerb = history[history.length - 1].verb;
  if (lastVerb !== sequence[sequence.length - 1]) return false;

  // Walk backwards through history matching sequence elements in order
  let seqIdx = sequence.length - 1;
  let earliestTime = now;

  for (let i = history.length - 1; i >= 0 && seqIdx >= 0; i--) {
    const entry = history[i];
    if (now - entry.time > windowSeconds) break;
    if (entry.verb === sequence[seqIdx]) {
      earliestTime = entry.time;
      seqIdx--;
    }
  }

  return seqIdx < 0 && now - earliestTime <= windowSeconds;
}

export function activateMech(
  fighter: FighterState,
  mechId: MechId,
  _now: number,
  meta?: number
): void {
  const def = MECH_DEFINITIONS[mechId];
  fighter.mechCooldowns[mechId] = def.cooldownSeconds;
  fighter.mechsTriggered += 1;

  if (mechId === 'phantom') {
    fighter.activeMech = { id: 'phantom', remaining: 0.55, duration: 0.55, power: 1 };
    fighter.intangibleToPlayers = true;
    // Slight velocity boost to slip past blockers cleanly
    fighter.vx *= 1.15;
  } else if (mechId === 'meteor') {
    fighter.activeMech = { id: 'meteor', remaining: 1.2, duration: 1.2, power: 1.35 };
    fighter.vy = Math.min(fighter.vy, -27.5);
  } else if (mechId === 'thunderbolt') {
    fighter.activeMech = { id: 'thunderbolt', remaining: 0.42, duration: 0.42, power: 1.25 };
    fighter.slideTimer = Math.max(fighter.slideTimer, 0.36);
    fighter.vx = fighter.facing * 23.5;
  } else if (mechId === 'spider') {
    fighter.activeMech = { id: 'spider', remaining: 0.48, duration: 0.48, power: 1.4 };
    // Amplified wall jump burst
    fighter.vx *= 1.38;
    fighter.vy = Math.max(fighter.vy, 19.5);
  } else if (mechId === 'comet') {
    const swingSpeed = meta ?? Math.hypot(fighter.vx, fighter.vy);
    const power = Math.min(2.1, Math.max(1.15, 0.9 + swingSpeed / 16));
    fighter.activeMech = { id: 'comet', remaining: 1.3, duration: 1.3, power };
    fighter.vx *= 1.22;
    fighter.vy = Math.min(fighter.vy, -24 - swingSpeed * 0.35);
  } else if (mechId === 'bulldozer') {
    fighter.activeMech = { id: 'bulldozer', remaining: 0.38, duration: 0.38, power: 1.55 };
    fighter.dashTimer = Math.max(fighter.dashTimer, 0.24);
    fighter.vx = fighter.facing * 26.0;
    fighter.vy = Math.max(fighter.vy, 1.5);
  }
}

export function tickFighterMechs(fighter: FighterState, dt: number): void {
  for (const key of Object.keys(fighter.mechCooldowns) as MechId[]) {
    if (fighter.mechCooldowns[key] > 0) {
      fighter.mechCooldowns[key] = Math.max(0, fighter.mechCooldowns[key] - dt);
    }
  }

  if (fighter.activeMech) {
    fighter.activeMech.remaining -= dt;
    if (fighter.activeMech.id === 'phantom') {
      fighter.intangibleToPlayers = fighter.activeMech.remaining > 0;
    }
    if (fighter.activeMech.remaining <= 0) {
      if (fighter.activeMech.id === 'phantom') {
        fighter.intangibleToPlayers = false;
      }
      fighter.activeMech = null;
    }
  } else {
    fighter.intangibleToPlayers = false;
  }
}

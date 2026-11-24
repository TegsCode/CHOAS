import { areTeammates, EMPTY_INPUT } from './physics.ts';
import type { FighterState, PlayerInput, SimulationState } from './types.ts';

/**
 * Computes tactical AI input for bot fighters.
 * Bots prioritize offstage survival (Double Jump, Grapple, Wall Jump),
 * hazard avoidance, and varied aggressive/evasive policies.
 */
export function computeAiInput(
  state: SimulationState,
  bot: FighterState,
  dt: number
): PlayerInput {
  if (!bot.alive) return EMPTY_INPUT;

  // Tutorial / Academy paced AI behaviors
  if (state.isTutorial && state.tutorialBotBehavior) {
    const behavior = state.tutorialBotBehavior;
    const homeX = state.tutorialBotHomeX ?? 5.0;
    const input: PlayerInput = { ...EMPTY_INPUT };
    bot.aiTimer -= dt;
    const player = state.fighters.find((f) => f.isHuman && f.alive);

    // Offstage safety so training bots do not accidentally walk off and steal focus
    const offEdge = bot.y < -0.6 || Math.abs(bot.x) > 13.5;
    if (offEdge && behavior !== 'dummy') {
      const backDir = bot.x > 0 ? -1 : 1;
      input.moveX = backDir;
      if (bot.vy < -1.0 && bot.doubleJumpAvailable) {
        input.jumpPressed = true;
        input.jumpHeld = true;
      }
      return input;
    }

    if (behavior === 'none') {
      return EMPTY_INPUT;
    }

    if (behavior === 'dummy') {
      if (bot.hitstunTimer <= 0 && Math.abs(bot.x - homeX) > 1.6 && bot.grounded) {
        input.moveX = bot.x < homeX ? 1 : -1;
      }
      return input;
    }

    if (behavior === 'telegraphed_striker') {
      if (player) {
        const dx = player.x - bot.x;
        const dist = Math.abs(dx);
        if (dist > 2.0 && Math.abs(bot.x - homeX) < 5.0) {
          input.moveX = dx > 0 ? 1 : -1;
        }
        if (dist < 2.25 && Math.abs(player.y - bot.y) < 1.4 && bot.aiTimer <= 0 && bot.attackCooldown <= 0) {
          bot.aiTimer = 2.15;
          input.attackPressed = true;
        }
      }
      return input;
    }

    if (behavior === 'passive_evader') {
      const patrolOffset = Math.sin(state.elapsed * 1.15 + bot.id) * 2.2;
      const targetX = homeX + patrolOffset;
      if (Math.abs(bot.x - targetX) > 0.6) {
        input.moveX = bot.x < targetX ? 1 : -1;
      }
      if (bot.aiTimer <= 0 && bot.grounded) {
        bot.aiTimer = 1.9;
        input.jumpPressed = true;
        input.jumpHeld = true;
      }
      return input;
    }

    if (behavior === 'patrol_guard') {
      if (player) {
        const dx = player.x - bot.x;
        const dy = player.y - bot.y;
        const dist = Math.hypot(dx, dy);
        // Stay anchored near homeX instead of charging recklessly off ledges
        if (dist < 4.8 && Math.abs(bot.x - homeX) < 4.2 && Math.abs(dx) > 1.55) {
          input.moveX = dx > 0 ? 1 : -1;
        } else if (Math.abs(bot.x - homeX) > 2.4 && bot.grounded) {
          input.moveX = bot.x < homeX ? 1 : -1;
        }
        if (dist < 2.0 && Math.abs(dy) < 1.35 && bot.aiTimer <= 0 && bot.attackCooldown <= 0) {
          bot.aiTimer = 1.25 - (state.tutorialBotAggression ?? 0.4) * 0.45;
          input.attackPressed = true;
        }
      }
      return input;
    }
    // 'chaser' falls through into full tactical AI scaled by tutorialBotAggression
  } else if (state.isTutorial && state.tutorialMode !== 'crucible') {
    const input: PlayerInput = { ...EMPTY_INPUT };
    bot.aiTimer -= dt;
    const player = state.fighters.find((f) => f.isHuman && f.alive);

    if (bot.x < 3.6) {
      input.moveX = 1;
    } else if (bot.x > 11.1 && bot.hitstunTimer <= 0 && bot.damagePercent < 40) {
      input.moveX = -1;
    } else if (bot.damagePercent < 35 && Math.abs(bot.x - 8.5) > 1.4 && bot.grounded) {
      input.moveX = bot.x < 8.5 ? 1 : -1;
    }

    if (player && Math.hypot(player.x - bot.x, player.y - bot.y) < 2.6) {
      if (bot.aiTimer <= 0 && bot.attackCooldown <= 0) {
        bot.aiTimer = 2.0;
        input.attackPressed = true;
      }
    }
    return input;
  }

  const input: PlayerInput = { ...EMPTY_INPUT };
  bot.aiTimer -= dt;

  // 1. Check if offstage or near abyss / lava
  const inDanger = bot.y < -0.5 || Math.abs(bot.x) > 13.5;
  const nearCenterDir = bot.x > 0 ? -1 : 1;

  if (inDanger) {
    input.moveX = nearCenterDir;
    input.moveY = 1;

    // Grapple back to overhead anchor or center platform
    if (!bot.grapple.active && bot.vy < 2.0 && Math.random() < 0.14) {
      input.grapplePressed = true;
      input.aimX = nearCenterDir * 0.65;
      input.aimY = 0.85;
    } else if (bot.grapple.active) {
      input.pullHeld = true;
      if (bot.y > 1.2 && bot.grapple.attachedTime > 0.45) {
        input.jumpPressed = true;
        input.jumpHeld = true;
      }
    } else if (bot.onWall !== 0) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    } else if (bot.vy < -1.5 && bot.doubleJumpAvailable) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    } else if (Math.abs(bot.x) > 12 && bot.dashCooldown <= 0 && !bot.grounded) {
      input.dashPressed = true;
    }
    return input;
  }

  // Release grapple once safely over platform
  if (bot.grapple.active) {
    input.moveX = nearCenterDir;
    if (bot.grapple.attachedTime > 0.65) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    } else {
      input.pullHeld = true;
    }
    return input;
  }

  // 2. Pick nearest alive opponent (never target Team Chaos allies)
  let target: FighterState | null = null;
  let bestDist = Infinity;
  for (const other of state.fighters) {
    if (!other.alive || other.id === bot.id) continue;
    if (areTeammates(state, bot, other)) continue;
    const d = Math.hypot(other.x - bot.x, other.y - bot.y);
    if (d < bestDist) {
      bestDist = d;
      target = other;
    }
  }

  if (!target && state.gameMode !== 'king_of_platform') return input;

  const dx = target ? target.x - bot.x : 0;
  const dy = target ? target.y - bot.y : 0;

  // Dodge central crusher in Factory
  if (state.arenaId === 'factory') {
    const crusher = state.hazards.find((h) => h.kind === 'crusher');
    if (crusher && (crusher.warningTimer > 0 || crusher.active) && Math.abs(bot.x - crusher.x) < 2.8) {
      input.moveX = bot.x >= 0 ? 1 : -1;
      if (bot.dashCooldown <= 0) input.dashPressed = true;
      return input;
    }
  }

  // King of the Platform objective positioning
  if (state.gameMode === 'king_of_platform' && state.kingZone) {
    const kz = state.kingZone;
    const distToZone = Math.hypot(kz.x - bot.x, kz.y - bot.y);
    if (kz.controllerId !== bot.id && distToZone > 1.4 && (!target || bestDist > 2.6)) {
      input.moveX = kz.x > bot.x ? 1 : -1;
      if (kz.y - bot.y > 1.3 && bot.grounded && Math.random() < 0.14) {
        input.jumpPressed = true;
        input.jumpHeld = true;
      } else if (!bot.grounded && bot.vy > 0) {
        input.jumpHeld = true;
      }
      if (!target) return input;
    }
  }

  if (!target) return input;

  // 3. Approach / Position
  if (Math.abs(dx) > 1.45) {
    input.moveX = dx > 0 ? 1 : -1;
  } else if (bot.aiPolicy === 'opportunist' && target.attack.phase === 'windup') {
    input.defendHeld = true;
  }

  // Jump toward higher target or randomly hop to keep combat vertical
  if (dy > 1.5 && bot.grounded && Math.random() < 0.08) {
    input.jumpPressed = true;
    input.jumpHeld = true;
  } else if (!bot.grounded && bot.vy > 0) {
    input.jumpHeld = true;
  }

  // 4. Occasional Dash / Slide / Dive / Mech plays
  if (bot.aiTimer <= 0) {
    bot.aiTimer = 0.32 + Math.random() * 0.45;
    if (Math.abs(dx) > 4.2 && Math.abs(dy) < 2.0 && bot.dashCooldown <= 0) {
      input.dashPressed = true;
    } else if (
      bot.grounded &&
      Math.abs(dx) > 2.6 &&
      Math.abs(dx) < 5.5 &&
      Math.abs(dy) < 1.2 &&
      bot.slideCooldown <= 0
    ) {
      input.slidePressed = true;
    } else if (!bot.grounded && dy < -1.5 && Math.abs(dx) < 2.6 && Math.random() < 0.45) {
      input.divePressed = true;
    } else if (
      bot.aiPolicy === 'acrobat' &&
      Math.abs(dx) > 5.0 &&
      Math.random() < 0.35
    ) {
      input.grapplePressed = true;
      input.aimX = Math.sign(dx) * 0.6;
      input.aimY = 0.85;
    }
  }

  // 5. Attack when in range
  if (Math.abs(dx) < 1.95 && Math.abs(dy) < 1.45 && bot.attackCooldown <= 0) {
    input.attackPressed = true;
  }

  // Defend briefly if opponent is actively swinging nearby
  if (
    target.attack.phase === 'windup' &&
    bestDist < 2.2 &&
    bot.posture > 35 &&
    Math.random() < 0.25
  ) {
    input.defendHeld = true;
  }

  return input;
}

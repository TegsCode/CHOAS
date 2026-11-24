import { PHYSICS } from './constants';
import { EquippedMechPalettes, resolveMechColors } from './missions';
import { FighterState } from './types';

const INK = '#141019';

export interface ClothNode {
  x: number;
  y: number;
}

export interface Afterimage {
  x: number;
  y: number;
  facing: 1 | -1;
  alpha: number;
  color: string;
}

export interface VisualFighterMemory {
  cloak: ClothNode[];
  scarfTip: ClothNode[];
  afterimages: Afterimage[];
  afterimageTimer: number;
  blinkTimer: number;
  initialized: boolean;
}

export function createFighterMemory(f: FighterState): VisualFighterMemory {
  const cloak: ClothNode[] = [];
  const scarfTip: ClothNode[] = [];
  for (let i = 0; i < 5; i++) {
    cloak.push({ x: f.x - f.facing * i * 0.16, y: f.y + 0.95 - i * 0.14 });
    scarfTip.push({ x: f.x - f.facing * i * 0.18, y: f.y + 1.05 - i * 0.06 });
  }
  return {
    cloak,
    scarfTip,
    afterimages: [],
    afterimageTimer: 0,
    blinkTimer: 1.5 + Math.random() * 2.5,
    initialized: true,
  };
}

export function updateFighterMemory(
  mem: VisualFighterMemory,
  f: FighterState,
  dt: number,
  elapsed: number,
  mechPalettes?: EquippedMechPalettes
): void {
  if (!mem.initialized) {
    Object.assign(mem, createFighterMemory(f));
  }

  mem.blinkTimer -= dt;
  if (mem.blinkTimer < -0.11) {
    mem.blinkTimer = 2.1 + Math.random() * 2.8;
  }

  // Simulate 5-node cloth ribbon in world units
  const anchorX = f.x - f.facing * 0.12;
  const anchorY = f.y + (f.slideTimer > 0 ? 0.55 : 0.98);
  mem.cloak[0].x = anchorX;
  mem.cloak[0].y = anchorY;

  const segLen = 0.22 * f.archetype.scale;
  const windX = Math.sin(elapsed * 3.4 + f.id * 1.7) * 1.8 - f.facing * 2.4;
  for (let i = 1; i < mem.cloak.length; i++) {
    const prev = mem.cloak[i - 1];
    const cur = mem.cloak[i];
    // Advect with ambient breeze + counter-velocity drag
    cur.x += (windX - f.vx * 0.45) * dt;
    cur.y += (-5.5 - f.vy * 0.22 + Math.cos(elapsed * 5 + i) * 0.9) * dt;

    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    cur.x = prev.x + (dx / dist) * segLen;
    cur.y = prev.y + (dy / dist) * segLen;
  }

  // Secondary scarf / flame ribbon
  mem.scarfTip[0].x = f.x - f.facing * 0.08;
  mem.scarfTip[0].y = f.y + (f.slideTimer > 0 ? 0.62 : 1.08);
  const scarfSeg = 0.2;
  for (let i = 1; i < mem.scarfTip.length; i++) {
    const prev = mem.scarfTip[i - 1];
    const cur = mem.scarfTip[i];
    cur.x += (windX * 1.3 - f.vx * 0.55) * dt;
    cur.y += (-2.2 - f.vy * 0.25 + Math.sin(elapsed * 7 + i * 1.3) * 1.6) * dt;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    cur.x = prev.x + (dx / dist) * scarfSeg;
    cur.y = prev.y + (dy / dist) * scarfSeg;
  }

  // Record crisp motion afterimages on Dash, Dive, or high-speed Mech
  mem.afterimageTimer -= dt;
  const speed = Math.hypot(f.vx, f.vy);
  const shouldTrail =
    f.alive &&
    (f.dashTimer > 0 ||
      f.diveActive ||
      f.activeMech?.id === 'phantom' ||
      f.activeMech?.id === 'comet' ||
      f.activeMech?.id === 'bulldozer' ||
      speed > 17);

  if (shouldTrail && mem.afterimageTimer <= 0) {
    mem.afterimageTimer = 0.028;
    const trailColor = f.activeMech
      ? resolveMechColors(f.activeMech.id, f.isHuman ? mechPalettes : undefined).color
      : f.archetype.accentColor;
    mem.afterimages.push({
      x: f.x,
      y: f.y,
      facing: f.facing,
      alpha: 0.58,
      color: trailColor,
    });
    if (mem.afterimages.length > 5) {
      mem.afterimages.shift();
    }
  }

  for (let i = mem.afterimages.length - 1; i >= 0; i--) {
    mem.afterimages[i].alpha -= dt * 3.4;
    if (mem.afterimages[i].alpha <= 0.02) {
      mem.afterimages.splice(i, 1);
    }
  }
}

export type WorldToScreenFn = (wx: number, wy: number) => { x: number; y: number };

function strokeFill(
  ctx: CanvasRenderingContext2D,
  fill: string,
  lineWidth: number,
  stroke = INK
) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function drawFighter2D(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  mem: VisualFighterMemory,
  toScreen: WorldToScreenFn,
  ppm: number,
  elapsed: number,
  mechPalettes?: EquippedMechPalettes
): void {
  if (!f.alive) return;

  const scale = f.archetype.scale;
  const u = ppm * scale; // pixels per fighter scale unit
  const inkW = Math.max(1.8, Math.min(3.4, ppm * 0.068));

  // 1. Afterimage silhouettes (drawn in world->screen before main character)
  for (const ghost of mem.afterimages) {
    const gp = toScreen(ghost.x, ghost.y);
    ctx.save();
    ctx.globalAlpha = ghost.alpha * 0.55;
    ctx.translate(gp.x, gp.y);
    ctx.scale(ghost.facing, 1);
    ctx.fillStyle = ghost.color;
    ctx.beginPath();
    ctx.ellipse(0, -0.78 * u, 0.34 * u, 0.62 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -1.32 * u, 0.25 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Flowing Cloth Cape / Scarf in World Space (smooth multi-node curve!)
  const drawCloth = (nodes: ClothNode[], widthBase: number, fill: string, innerGlow?: string) => {
    if (nodes.length < 3) return;
    const pts = nodes.map((n) => toScreen(n.x, n.y));
    ctx.save();
    if (f.intangibleToPlayers) ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - widthBase * 0.22 * u);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const mx = (prev.x + cur.x) * 0.5;
      const my = (prev.y + cur.y) * 0.5;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    const tail = pts[pts.length - 1];
    ctx.lineTo(tail.x, tail.y);
    for (let i = pts.length - 1; i >= 0; i--) {
      const t = i / (pts.length - 1);
      const thick = (widthBase * (0.35 + t * 0.65)) * u;
      ctx.lineTo(pts[i].x, pts[i].y + thick);
    }
    ctx.closePath();
    strokeFill(ctx, f.hitFlashTimer > 0 ? '#fff6de' : fill, inkW);

    if (innerGlow && f.hitFlashTimer <= 0) {
      ctx.beginPath();
      ctx.moveTo(pts[1].x, pts[1].y + widthBase * 0.3 * u);
      ctx.lineTo(tail.x, tail.y + widthBase * 0.72 * u);
      ctx.lineTo(pts[2].x, pts[2].y + widthBase * 0.55 * u);
      ctx.closePath();
      ctx.fillStyle = innerGlow;
      ctx.fill();
    }
    ctx.restore();
  };

  if (f.archetype.cloakStyle === 'tattered' || f.archetype.cloakStyle === 'cape') {
    drawCloth(mem.cloak, 0.42, f.archetype.primaryColor, f.archetype.accentColor);
  } else {
    drawCloth(mem.scarfTip, 0.22, f.archetype.accentColor);
  }

  // 3. Main Articulated Body Transform
  const foot = toScreen(f.x, f.y);
  ctx.save();
  ctx.translate(foot.x, foot.y);

  if (f.intangibleToPlayers) {
    ctx.globalAlpha = 0.56;
  }

  // Active Mech ground/body aura UNDER character
  if (f.activeMech) {
    const mCol = resolveMechColors(f.activeMech.id, f.isHuman ? mechPalettes : undefined);
    drawMechAuraUnder(ctx, f, mCol.color, mCol.secondaryColor, u, inkW, elapsed);
  }

  // Pivot around center of mass for ragdoll spin or dive pitch
  const torsoMidY = -0.78 * u;
  ctx.translate(0, torsoMidY);
  if (Math.abs(f.ragdollAngle) > 0.02) {
    ctx.rotate(-f.ragdollAngle);
  } else if (f.diveActive) {
    ctx.rotate(f.facing * 0.55);
  } else if (f.slideTimer > 0) {
    ctx.rotate(-f.facing * 0.62);
  } else if (f.dashTimer > 0) {
    ctx.rotate(f.facing * 0.28);
  } else if (f.grounded && Math.abs(f.vx) > 2.5) {
    ctx.rotate(f.facing * Math.min(0.22, Math.abs(f.vx) * 0.015));
  } else if (f.grapple.active && f.grapple.phase === 'attached') {
    const ang = Math.atan2(f.grapple.anchorX - f.x, f.grapple.anchorY - (f.y + 0.9));
    ctx.rotate(ang * 0.45);
  }
  ctx.translate(0, -torsoMidY);

  ctx.scale(f.facing * f.squashX, f.squashY);

  // Subtle idle breath & run bounce
  const isMoving = Math.abs(f.vx) > 0.9;
  const stridePhase = f.strideDistance * 2.85;
  const idleBob = f.grounded && !isMoving ? Math.sin(elapsed * 4.5 + f.id) * 0.035 * u : 0;
  const runBob = f.grounded && isMoving ? Math.abs(Math.sin(stridePhase)) * -0.06 * u : 0;
  const bodyYOffset = f.slideTimer > 0 ? 0.25 * u : idleBob + runBob;

  const flash = f.hitFlashTimer > 0;
  const primary = flash ? '#fff6de' : f.archetype.primaryColor;
  const secondary = flash ? '#fff6de' : f.archetype.secondaryColor;
  const accent = flash ? '#fff6de' : f.archetype.accentColor;

  // --- LEGS (2-segment expressive limbs) ---
  const drawLeg = (hipX: number, hipY: number, phaseOffset: number, back: boolean) => {
    let kneeX = hipX + 0.08 * u;
    let kneeY = hipY + 0.26 * u;
    let footX = hipX;
    let footY = -0.04 * u;

    if (f.slideTimer > 0) {
      kneeX = hipX + (back ? -0.18 : 0.28) * u;
      kneeY = hipY + 0.16 * u;
      footX = hipX + (back ? -0.35 : 0.48) * u;
      footY = -0.05 * u;
    } else if (!f.grounded) {
      const tuck = f.vy > 0 ? -0.14 * u : 0.04 * u;
      kneeX = hipX + (back ? -0.12 : 0.22) * u;
      kneeY = hipY + 0.22 * u + tuck;
      footX = hipX + (back ? -0.22 : 0.14) * u;
      footY = hipY + 0.42 * u + tuck;
    } else if (isMoving) {
      const s = Math.sin(stridePhase + phaseOffset);
      const c = Math.cos(stridePhase + phaseOffset);
      footX = hipX + s * 0.26 * u;
      footY = -0.04 * u - Math.max(0, c) * 0.16 * u;
      kneeX = (hipX + footX) * 0.5 + 0.11 * u;
      kneeY = (hipY + footY) * 0.5 - 0.04 * u;
    } else {
      footX = hipX + (back ? -0.12 : 0.14) * u;
    }

    ctx.lineWidth = Math.max(3, 0.14 * u);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.5, 0.085 * u);
    ctx.strokeStyle = back ? secondary : f.hitFlashTimer > 0 ? '#fff6de' : '#322b3d';
    ctx.stroke();

    // Boot / foot accent
    ctx.beginPath();
    ctx.ellipse(footX + 0.05 * u, footY, 0.1 * u, 0.055 * u, 0, 0, Math.PI * 2);
    strokeFill(ctx, secondary, inkW * 0.8);
  };

  const hipY = -0.48 * u + bodyYOffset;
  drawLeg(-0.07 * u, hipY, Math.PI, true);
  drawLeg(0.08 * u, hipY, 0, false);

  // --- TORSO & TUNIC ---
  const torsoBottomY = -0.46 * u + bodyYOffset;
  const torsoTopY = -1.04 * u + bodyYOffset;

  ctx.beginPath();
  ctx.moveTo(-0.2 * u, torsoTopY + 0.04 * u);
  ctx.quadraticCurveTo(0.02 * u, torsoTopY - 0.05 * u, 0.22 * u, torsoTopY + 0.05 * u);
  ctx.lineTo(0.24 * u, torsoBottomY + 0.08 * u);
  ctx.quadraticCurveTo(0, torsoBottomY + 0.14 * u, -0.22 * u, torsoBottomY + 0.06 * u);
  ctx.closePath();
  strokeFill(ctx, secondary, inkW);

  // Draped shoulder tunic / sash
  ctx.beginPath();
  ctx.moveTo(-0.24 * u, torsoTopY + 0.02 * u);
  ctx.quadraticCurveTo(0, torsoTopY - 0.08 * u, 0.24 * u, torsoTopY + 0.03 * u);
  ctx.lineTo(0.28 * u, torsoTopY + 0.36 * u);
  ctx.quadraticCurveTo(0.06 * u, torsoTopY + 0.44 * u, -0.22 * u, torsoTopY + 0.34 * u);
  ctx.closePath();
  strokeFill(ctx, primary, inkW);

  // Belt + buckle detail (Screenshot #6 inspired)
  ctx.beginPath();
  ctx.roundRect(-0.21 * u, torsoBottomY - 0.14 * u, 0.42 * u, 0.1 * u, 0.03 * u);
  strokeFill(ctx, accent, inkW * 0.8);

  // --- BACK ARM ---
  const shoulderY = torsoTopY + 0.12 * u;
  drawArmAndWeapon(ctx, f, -0.14 * u, shoulderY, true, u, inkW, primary, accent, stridePhase, elapsed);

  // --- HEAD & CHARACTER GEAR ---
  const headY = torsoTopY - 0.22 * u;
  drawFighterHead(ctx, f, mem, 0.02 * u, headY, u, inkW, primary, secondary, accent, elapsed, flash);

  // --- FRONT ARM + HELD WEAPON ---
  drawArmAndWeapon(ctx, f, 0.12 * u, shoulderY, false, u, inkW, primary, accent, stridePhase, elapsed);

  // --- ATTACK SMEAR CRESCENT (Screenshot #5 bold fluid smear!) ---
  if (
    f.attack.phase === 'active' ||
    f.attack.phase === 'windup' ||
    (f.attack.phase === 'recovery' && f.attack.timer < 0.085)
  ) {
    drawAttackSmear(ctx, f, torsoTopY + 0.12 * u, u, inkW, accent);
  }

  // --- GUARD BUCKER / PARRY FLASH ---
  if (f.defending && f.guardBreakTimer <= 0) {
    const isParry = f.defendTimer <= PHYSICS.PARRY_WINDOW;
    ctx.save();
    ctx.translate(0.18 * u, -0.78 * u);
    ctx.beginPath();
    ctx.arc(0, 0, 0.62 * u, -Math.PI * 0.48, Math.PI * 0.48);
    ctx.lineWidth = (isParry ? 0.12 : 0.08) * u;
    ctx.strokeStyle = isParry ? '#fde68a' : '#e0c68c';
    ctx.stroke();

    ctx.lineWidth = inkW * 0.75;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(0, 0, 0.66 * u, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  // --- OVERLAY MECH EFFECTS (Lightning / Flame Cone / Ram Prow) ---
  if (f.activeMech) {
    const mCol = resolveMechColors(f.activeMech.id, f.isHuman ? mechPalettes : undefined);
    drawMechAuraOver(ctx, f, mCol.color, u, inkW, elapsed);
  }

  ctx.restore();
}

function drawFighterHead(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  mem: VisualFighterMemory,
  hx: number,
  hy: number,
  u: number,
  inkW: number,
  primary: string,
  secondary: string,
  accent: string,
  elapsed: number,
  flash: boolean
): void {
  const style = f.archetype.headStyle;
  const blinking = mem.blinkTimer < 0 && f.hitstunTimer <= 0;
  const hurt = f.hitstunTimer > 0;

  ctx.save();
  ctx.translate(hx, hy);

  if (style === 'flame') {
    // Dancing flame-spirit head (Screenshots #1 & #6)
    const flicker = Math.sin(elapsed * 14 + f.id) * 0.07 * u;
    const flicker2 = Math.cos(elapsed * 11 + f.id) * 0.06 * u;
    ctx.beginPath();
    ctx.moveTo(-0.24 * u, 0.16 * u);
    ctx.bezierCurveTo(-0.34 * u, -0.05 * u, -0.25 * u, -0.35 * u, -0.04 * u + flicker2, -0.5 * u);
    ctx.quadraticCurveTo(0.02 * u, -0.32 * u, 0.14 * u + flicker, -0.44 * u);
    ctx.bezierCurveTo(0.3 * u, -0.25 * u, 0.3 * u, 0.02 * u, 0.22 * u, 0.16 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW);

    // Bright inner core
    if (!flash) {
      ctx.beginPath();
      ctx.ellipse(0.02 * u, -0.02 * u, 0.18 * u, 0.17 * u, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fde6a2';
      ctx.fill();
    }
  } else if (style === 'horned_mask') {
    // Twin curved horns + cracked ivory mask (Screenshot #7)
    ctx.beginPath();
    ctx.moveTo(-0.14 * u, -0.16 * u);
    ctx.quadraticCurveTo(-0.32 * u, -0.42 * u, -0.16 * u, -0.52 * u);
    ctx.quadraticCurveTo(-0.16 * u, -0.34 * u, -0.04 * u, -0.2 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW);

    ctx.beginPath();
    ctx.moveTo(0.14 * u, -0.16 * u);
    ctx.quadraticCurveTo(0.32 * u, -0.42 * u, 0.16 * u, -0.52 * u);
    ctx.quadraticCurveTo(0.16 * u, -0.34 * u, 0.04 * u, -0.2 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW);

    ctx.beginPath();
    ctx.ellipse(0, 0, 0.24 * u, 0.26 * u, 0, 0, Math.PI * 2);
    strokeFill(ctx, flash ? '#fff6de' : '#efe7d6', inkW);
  } else if (style === 'hood' || style === 'skull_hood') {
    // Pointed ranger / sentinel hood (Screenshot #8)
    ctx.beginPath();
    ctx.moveTo(-0.32 * u, 0.16 * u);
    ctx.quadraticCurveTo(-0.38 * u, -0.15 * u, -0.18 * u, -0.34 * u);
    ctx.lineTo(0.18 * u, -0.28 * u);
    ctx.quadraticCurveTo(0.32 * u, -0.12 * u, 0.22 * u, 0.14 * u);
    ctx.closePath();
    strokeFill(ctx, primary, inkW);

    ctx.beginPath();
    ctx.arc(0.04 * u, 0.02 * u, 0.18 * u, 0, Math.PI * 2);
    strokeFill(ctx, flash ? '#fff6de' : style === 'skull_hood' ? '#e6dec8' : '#18141f', inkW * 0.85);
  } else if (style === 'ronin_hat') {
    // Shadowed head + wide woven kasa hat (Screenshot #4)
    ctx.beginPath();
    ctx.arc(0, 0.03 * u, 0.19 * u, 0, Math.PI * 2);
    strokeFill(ctx, secondary, inkW);

    ctx.beginPath();
    ctx.moveTo(-0.46 * u, -0.05 * u);
    ctx.lineTo(0, -0.34 * u);
    ctx.lineTo(0.46 * u, -0.05 * u);
    ctx.quadraticCurveTo(0, -0.12 * u, -0.46 * u, -0.05 * u);
    ctx.closePath();
    strokeFill(ctx, primary, inkW);
  } else if (style === 'brute_horns') {
    // Broad jaw + bull horns
    ctx.beginPath();
    ctx.moveTo(-0.2 * u, -0.12 * u);
    ctx.quadraticCurveTo(-0.42 * u, -0.24 * u, -0.32 * u, -0.42 * u);
    ctx.quadraticCurveTo(-0.24 * u, -0.24 * u, -0.12 * u, -0.18 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW);

    ctx.beginPath();
    ctx.moveTo(0.2 * u, -0.12 * u);
    ctx.quadraticCurveTo(0.42 * u, -0.24 * u, 0.32 * u, -0.42 * u);
    ctx.quadraticCurveTo(0.24 * u, -0.24 * u, 0.12 * u, -0.18 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW);

    ctx.beginPath();
    ctx.roundRect(-0.24 * u, -0.24 * u, 0.48 * u, 0.44 * u, 0.12 * u);
    strokeFill(ctx, secondary, inkW);
  } else if (style === 'cyber_visor') {
    // Acrobat cowl + angled visor ribbon
    ctx.beginPath();
    ctx.arc(0, 0, 0.23 * u, 0, Math.PI * 2);
    strokeFill(ctx, secondary, inkW);

    ctx.beginPath();
    ctx.roundRect(-0.04 * u, -0.08 * u, 0.28 * u, 0.11 * u, 0.04 * u);
    strokeFill(ctx, accent, inkW * 0.85);
  } else {
    // Imp horns
    ctx.beginPath();
    ctx.moveTo(-0.14 * u, -0.15 * u);
    ctx.lineTo(-0.28 * u, -0.42 * u);
    ctx.lineTo(-0.04 * u, -0.22 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW);

    ctx.beginPath();
    ctx.moveTo(0.14 * u, -0.15 * u);
    ctx.lineTo(0.28 * u, -0.42 * u);
    ctx.lineTo(0.04 * u, -0.22 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW);

    ctx.beginPath();
    ctx.arc(0, 0, 0.22 * u, 0, Math.PI * 2);
    strokeFill(ctx, primary, inkW);
  }

  // Expressive Eyes
  if (!flash && style !== 'cyber_visor') {
    const eyeFill = style === 'horned_mask' || style === 'skull_hood' ? INK : f.archetype.eyeColor;
    if (hurt) {
      // Comic X eyes on knockback/hitstun
      ctx.strokeStyle = eyeFill;
      ctx.lineWidth = inkW * 0.85;
      ctx.beginPath();
      ctx.moveTo(0.02 * u, -0.05 * u);
      ctx.lineTo(0.14 * u, 0.06 * u);
      ctx.moveTo(0.14 * u, -0.05 * u);
      ctx.lineTo(0.02 * u, 0.06 * u);
      ctx.stroke();
    } else if (blinking) {
      ctx.strokeStyle = eyeFill;
      ctx.lineWidth = inkW * 0.8;
      ctx.beginPath();
      ctx.moveTo(-0.04 * u, 0);
      ctx.lineTo(0.05 * u, 0);
      ctx.moveTo(0.1 * u, 0);
      ctx.lineTo(0.18 * u, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = eyeFill;
      ctx.beginPath();
      ctx.ellipse(0.01 * u, 0, 0.045 * u, 0.068 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0.14 * u, 0, 0.045 * u, 0.068 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawArmAndWeapon(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  sx: number,
  sy: number,
  isBack: boolean,
  u: number,
  inkW: number,
  primary: string,
  accent: string,
  stridePhase: number,
  elapsed: number
): void {
  let handX = sx + (isBack ? -0.18 : 0.22) * u;
  let handY = sy + 0.26 * u;

  if (!isBack && f.grapple.active) {
    // Reach hand toward grapple hook/rope!
    const dx = (f.grapple.hookX - f.x) * f.facing;
    const dy = -(f.grapple.hookY - (f.y + 0.9));
    const len = Math.hypot(dx, dy) || 1;
    handX = sx + (dx / len) * 0.38 * u;
    handY = sy + (dy / len) * 0.38 * u;
  } else if (!isBack && f.attack.phase === 'windup') {
    handX = sx - 0.28 * u;
    handY = sy - 0.14 * u;
  } else if (!isBack && f.attack.phase === 'active') {
    handX = sx + 0.42 * u;
    handY = sy + 0.02 * u;
  } else if (!isBack && f.defending) {
    handX = sx + 0.24 * u;
    handY = sy + 0.04 * u;
  } else if (Math.abs(f.vx) > 1.0) {
    const swing = Math.sin(stridePhase + (isBack ? 0 : Math.PI)) * 0.18 * u;
    handX = sx + swing;
    handY = sy + 0.24 * u;
  } else {
    handY = sy + 0.25 * u + Math.sin(elapsed * 4 + f.id) * 0.03 * u;
  }

  const elbowX = (sx + handX) * 0.5 - 0.06 * u;
  const elbowY = (sy + handY) * 0.5 + 0.07 * u;

  ctx.lineWidth = Math.max(2.5, 0.11 * u);
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  ctx.lineWidth = Math.max(1.4, 0.065 * u);
  ctx.strokeStyle = isBack ? f.archetype.secondaryColor : primary;
  ctx.stroke();

  // Hand / Fist
  ctx.beginPath();
  ctx.arc(handX, handY, (f.archetype.weaponStyle === 'gauntlets' ? 0.11 : 0.065) * u, 0, Math.PI * 2);
  strokeFill(ctx, f.archetype.weaponStyle === 'gauntlets' ? accent : primary, inkW * 0.8);

  if (isBack) return;

  // Held Weapon on front hand
  const wStyle = f.archetype.weaponStyle;
  let wAngle = 0.35;
  if (f.attack.phase === 'windup') wAngle = -2.2;
  else if (f.attack.phase === 'active') wAngle = 0.05;
  else if (f.attack.phase === 'recovery') wAngle = 1.05;

  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(wAngle);

  if (wStyle === 'blade') {
    // Notched indie iron greatsword / katana (Screenshot #8)
    ctx.beginPath();
    ctx.moveTo(0, -0.04 * u);
    ctx.lineTo(0.68 * u, -0.06 * u);
    ctx.lineTo(0.8 * u, 0);
    ctx.lineTo(0.66 * u, 0.06 * u);
    ctx.lineTo(0.45 * u, 0.05 * u);
    ctx.lineTo(0.41 * u, 0.02 * u);
    ctx.lineTo(0.36 * u, 0.05 * u);
    ctx.lineTo(0, 0.04 * u);
    ctx.closePath();
    strokeFill(ctx, '#dcd4c6', inkW * 0.85);

    ctx.beginPath();
    ctx.roundRect(-0.04 * u, -0.1 * u, 0.08 * u, 0.2 * u, 0.02 * u);
    strokeFill(ctx, accent, inkW * 0.75);
  } else if (wStyle === 'staff') {
    // Ember cinder staff (Screenshot #1)
    ctx.beginPath();
    ctx.roundRect(-0.28 * u, -0.028 * u, 0.96 * u, 0.056 * u, 0.02 * u);
    strokeFill(ctx, '#382c36', inkW * 0.8);

    ctx.beginPath();
    ctx.moveTo(0.68 * u, 0);
    ctx.lineTo(0.82 * u, -0.1 * u);
    ctx.lineTo(0.95 * u, 0);
    ctx.lineTo(0.82 * u, 0.1 * u);
    ctx.closePath();
    strokeFill(ctx, accent, inkW * 0.8);
  } else if (wStyle === 'scythe') {
    // Reaper crescent scythe
    ctx.beginPath();
    ctx.roundRect(-0.24 * u, -0.028 * u, 0.96 * u, 0.056 * u, 0.02 * u);
    strokeFill(ctx, '#29222c', inkW * 0.8);

    ctx.beginPath();
    ctx.moveTo(0.68 * u, -0.04 * u);
    ctx.quadraticCurveTo(0.95 * u, 0.14 * u, 0.62 * u, 0.42 * u);
    ctx.quadraticCurveTo(0.76 * u, 0.18 * u, 0.58 * u, 0.02 * u);
    ctx.closePath();
    strokeFill(ctx, '#e2dacb', inkW * 0.85);
  }

  ctx.restore();
}

function drawAttackSmear(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  centerY: number,
  u: number,
  inkW: number,
  accent: string
): void {
  if (f.attack.phase === 'windup') {
    // Crisp telegraph spark on weapon pullback
    ctx.save();
    ctx.translate(-0.2 * u, centerY - 0.15 * u);
    ctx.fillStyle = '#fff5d6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = inkW * 0.7;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 0.22 * u : 0.06 * u;
      const a = (i * Math.PI) / 4;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Huge fluid smear crescent matching Screenshot #5
  ctx.save();
  ctx.translate(0.18 * u, centerY + 0.08 * u);
  ctx.beginPath();
  ctx.arc(0, 0, 1.25 * u, -Math.PI * 0.48, Math.PI * 0.44);
  ctx.arc(-0.22 * u, 0, 0.96 * u, Math.PI * 0.44, -Math.PI * 0.48, true);
  ctx.closePath();
  strokeFill(ctx, '#fbf4e2', inkW * 0.85);

  ctx.beginPath();
  ctx.arc(0.02 * u, 0, 1.15 * u, -Math.PI * 0.36, Math.PI * 0.34);
  ctx.arc(-0.14 * u, 0, 1.02 * u, Math.PI * 0.34, -Math.PI * 0.36, true);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
}

function drawMechAuraUnder(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  color: string,
  secondary: string,
  u: number,
  inkW: number,
  elapsed: number
): void {
  const id = f.activeMech?.id;
  if (!id) return;

  ctx.save();
  if (id === 'meteor' || id === 'comet') {
    // Blazing flame cone wrapping character
    const wobble = Math.sin(elapsed * 24) * 0.1 * u;
    ctx.beginPath();
    ctx.moveTo(0, 0.12 * u);
    ctx.quadraticCurveTo(-0.75 * u, -0.55 * u, -0.4 * u + wobble, -1.75 * u);
    ctx.lineTo(0, -1.45 * u);
    ctx.lineTo(0.42 * u - wobble, -1.75 * u);
    ctx.quadraticCurveTo(0.75 * u, -0.55 * u, 0, 0.12 * u);
    ctx.closePath();
    strokeFill(ctx, color, inkW);
  } else if (id === 'spider') {
    // Web-silk ring around waist
    ctx.strokeStyle = color;
    ctx.lineWidth = inkW * 1.1;
    ctx.beginPath();
    ctx.arc(0, -0.75 * u, 0.65 * u, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Soft painted ink aura halo
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.ellipse(0, -0.75 * u, 0.65 * u, 0.9 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMechAuraOver(
  ctx: CanvasRenderingContext2D,
  f: FighterState,
  color: string,
  u: number,
  inkW: number,
  elapsed: number
): void {
  const id = f.activeMech?.id;
  if (!id) return;

  ctx.save();
  if (id === 'thunderbolt') {
    // Jagged inked lightning arcs snapping around character
    ctx.strokeStyle = INK;
    ctx.lineWidth = inkW * 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < 2; k++) {
      const phase = Math.floor(elapsed * 18) + k * 7;
      const ox = (k === 0 ? -0.4 : 0.35) * u;
      ctx.beginPath();
      ctx.moveTo(ox, -1.35 * u);
      ctx.lineTo(ox + ((phase % 3) - 1) * 0.22 * u, -0.95 * u);
      ctx.lineTo(ox - ((phase % 2) ? 0.16 : -0.16) * u, -0.55 * u);
      ctx.lineTo(ox + 0.12 * u, -0.12 * u);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = inkW * 0.9;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = inkW * 1.7;
    }
  } else if (id === 'bulldozer') {
    // Armored ram prow chevron in front of charging fighter
    ctx.beginPath();
    ctx.moveTo(0.28 * u, -1.25 * u);
    ctx.lineTo(0.86 * u, -0.75 * u);
    ctx.lineTo(0.28 * u, -0.25 * u);
    ctx.lineTo(0.46 * u, -0.75 * u);
    ctx.closePath();
    strokeFill(ctx, color, inkW);
  }
  ctx.restore();
}

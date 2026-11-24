import {
  createFighterMemory,
  drawFighter2D,
  updateFighterMemory,
  VisualFighterMemory,
  WorldToScreenFn,
} from './characterCanvas';
import { PHYSICS } from './constants';
import type { EquippedMechPalettes } from './missions';
import {
  ArenaId,
  FighterState,
  HazardZone,
  KingZoneState,
  PlatformRect,
  SimulationState,
} from './types';

const INK = '#141019';

export type VfxKind = 'dust' | 'spark' | 'starburst' | 'ring' | 'ko_beam';

interface VfxSlot {
  active: boolean;
  kind: VfxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  maxSize: number;
  angle: number;
  spin: number;
  color: string;
}

const VFX_POOL_SIZE = 320;

export interface Camera2D {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
}

export class Renderer2D {
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 1280;
  private height = 720;

  public cam: Camera2D = { x: 0, y: 2.8, zoom: 14.5, shakeX: 0, shakeY: 0 };
  private memories = new Map<number, VisualFighterMemory>();
  private vfxPool: VfxSlot[] = [];
  private vfxCursor = 0;
  private backdropCanvas: HTMLCanvasElement;
  private backdropCtx: CanvasRenderingContext2D;
  private backdropKey = '';
  private humanMechPalettes: EquippedMechPalettes = {};

  public setHumanMechPalettes(palettes: EquippedMechPalettes): void {
    this.humanMechPalettes = { ...palettes };
  }

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.dataset.testid = 'chaos-canvas';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = ctx;

    this.backdropCanvas = document.createElement('canvas');
    const bCtx = this.backdropCanvas.getContext('2d');
    if (!bCtx) {
      throw new Error('Could not initialize offscreen backdrop context');
    }
    this.backdropCtx = bCtx;

    for (let i = 0; i < VFX_POOL_SIZE; i++) {
      this.vfxPool.push({
        active: false,
        kind: 'dust',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        maxSize: 1,
        angle: 0,
        spin: 0,
        color: '#f4ead5',
      });
    }

    this.resize(container.clientWidth, container.clientHeight);
  }

  public resize(cssW: number, cssH: number): void {
    this.width = Math.max(1, cssW);
    this.height = Math.max(1, cssH);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  public getPixelsPerMeter(): number {
    const base = Math.min(this.height / this.cam.zoom, this.width / (this.cam.zoom * 1.65));
    return Math.max(16, base);
  }

  public worldToScreen: WorldToScreenFn = (wx: number, wy: number) => {
    const ppm = this.getPixelsPerMeter();
    const cx = this.width * 0.5;
    const cy = this.height * 0.54;
    return {
      x: cx + (wx - (this.cam.x + this.cam.shakeX)) * ppm,
      y: cy - (wy - (this.cam.y + this.cam.shakeY)) * ppm,
    };
  };

  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const ppm = this.getPixelsPerMeter();
    const cx = this.width * 0.5;
    const cy = this.height * 0.54;
    return {
      x: (sx - cx) / ppm + this.cam.x,
      y: -(sy - cy) / ppm + this.cam.y,
    };
  }

  public resetMemories(fighters: FighterState[]): void {
    this.memories.clear();
    for (const f of fighters) {
      this.memories.set(f.id, createFighterMemory(f));
    }
    for (const v of this.vfxPool) {
      v.active = false;
    }
  }

  public spawnVfx(
    kind: VfxKind,
    x: number,
    y: number,
    color: string,
    count = 1,
    speed = 6,
    size = 0.25,
    maxSize = 3.2
  ): void {
    for (let i = 0; i < count; i++) {
      const slot = this.vfxPool[this.vfxCursor];
      this.vfxCursor = (this.vfxCursor + 1) % VFX_POOL_SIZE;
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      slot.active = true;
      slot.kind = kind;
      slot.x = x + (kind === 'ring' || kind === 'ko_beam' ? 0 : (Math.random() - 0.5) * 0.35);
      slot.y = y + (kind === 'ring' || kind === 'ko_beam' ? 0 : (Math.random() - 0.5) * 0.35);
      slot.vx = kind === 'ring' || kind === 'ko_beam' ? 0 : Math.cos(ang) * spd;
      slot.vy = kind === 'ring' || kind === 'ko_beam' ? 0 : Math.sin(ang) * spd + 1.4;
      slot.maxLife =
        kind === 'ring'
          ? 0.36
          : kind === 'ko_beam'
            ? 0.52
            : kind === 'starburst'
              ? 0.22
              : 0.26 + Math.random() * 0.26;
      slot.life = slot.maxLife;
      slot.size = size * (0.75 + Math.random() * 0.5);
      slot.maxSize = maxSize;
      slot.angle = Math.random() * Math.PI * 2;
      slot.spin = (Math.random() - 0.5) * 10;
      slot.color = color;
    }
  }

  public updateVisuals(sim: SimulationState, dt: number): void {
    for (const f of sim.fighters) {
      let mem = this.memories.get(f.id);
      if (!mem) {
        mem = createFighterMemory(f);
        this.memories.set(f.id, mem);
      }
      updateFighterMemory(
        mem,
        f,
        dt,
        sim.elapsed,
        f.isHuman ? this.humanMechPalettes : undefined
      );
    }

    for (let i = 0; i < VFX_POOL_SIZE; i++) {
      const v = this.vfxPool[i];
      if (!v.active) continue;
      v.life -= dt;
      if (v.life <= 0) {
        v.active = false;
        continue;
      }
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      v.angle += v.spin * dt;
      if (v.kind === 'spark') {
        v.vy -= 14 * dt;
      } else if (v.kind === 'dust') {
        v.vx *= Math.max(0, 1 - 4 * dt);
        v.vy += 1.2 * dt;
      }
    }
  }

  public updateCamera(
    sim: SimulationState,
    dt: number,
    isTitle: boolean,
    focusPoint?: { x: number; y: number } | null
  ): void {
    const damp = 1 - Math.exp(-6.2 * dt);

    if (isTitle) {
      const panX = Math.sin(sim.elapsed * 0.24) * 1.4;
      const panY = 1.55 + Math.cos(sim.elapsed * 0.34) * 0.3;
      this.cam.x += (panX - this.cam.x) * damp;
      this.cam.y += (panY - this.cam.y) * damp;
      this.cam.zoom += (15.6 - this.cam.zoom) * damp;
      this.cam.shakeX = 0;
      this.cam.shakeY = 0;
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let count = 0;

    for (const f of sim.fighters) {
      if (!f.alive) continue;
      count++;
      if (f.x < minX) minX = f.x;
      if (f.x > maxX) maxX = f.x;
      if (f.y < minY) minY = f.y;
      if (f.y > maxY) maxY = f.y;
    }

    if (focusPoint && Number.isFinite(focusPoint.x) && Number.isFinite(focusPoint.y)) {
      count++;
      if (focusPoint.x < minX) minX = focusPoint.x;
      if (focusPoint.x > maxX) maxX = focusPoint.x;
      if (focusPoint.y < minY) minY = focusPoint.y;
      if (focusPoint.y > maxY) maxY = focusPoint.y;
    }

    let targetX = 0;
    let targetY = 2.6;
    let targetZoom = 14.5;

    if (count > 0) {
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5 + 1.0;
      const spanX = Math.max(12, maxX - minX + (focusPoint ? 11.5 : 9.5));
      const spanY = Math.max(8, maxY - minY + 6.5);
      const aspect = this.width / Math.max(1, this.height);
      targetX = Math.max(-9, Math.min(9, cx * (focusPoint ? 0.92 : 0.78) - (focusPoint ? 1.1 : 0)));
      targetY = Math.max(1.6, Math.min(7.2, cy * 0.68 + 0.9));
      targetZoom = Math.max(12.2, Math.min(20.5, Math.max(spanY, spanX / (aspect * 0.95))));
    }

    this.cam.x += (targetX - this.cam.x) * damp;
    this.cam.y += (targetY - this.cam.y) * damp;
    this.cam.zoom += (targetZoom - this.cam.zoom) * damp;

    const shake = sim.trauma * sim.trauma * 0.52;
    this.cam.shakeX = (Math.random() - 0.5) * shake;
    this.cam.shakeY = (Math.random() - 0.5) * shake;
  }

  public render(
    sim: SimulationState,
    options: {
      isPlaying: boolean;
      waypoint?: { x: number; y: number; color?: string } | null;
      targetZone?: { x: number; y: number; w: number; h: number; label?: string } | null;
      aimWorld?: { x: number; y: number; active: boolean };
    }
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const ppm = this.getPixelsPerMeter();
    const inkW = Math.max(1.8, Math.min(3.5, ppm * 0.068));

    // 1. Hand-drawn multi-plane parallax backdrop + weather/biome atmosphere
    this.drawBackdrop(ctx, sim.arenaId, sim.elapsed);

    // 2. Background Hazards (lava under platforms)
    for (const haz of sim.hazards) {
      if (haz.kind === 'lava') {
        this.drawHazard(ctx, haz, ppm, inkW, sim.elapsed);
      }
    }

    // 2.5 Overworld Camp Tent & Campfire anchored cleanly onto left campsite bluff
    if (sim.arenaId === 'meadow') {
      this.drawOverworldTentAndCamp(ctx, -11.1, 1.975, ppm, inkW, sim.elapsed);
    }

    // 3. Hand-inked platforms, beams, toadstools & crates
    for (const plat of sim.platforms) {
      if (plat.broken) continue;
      this.drawPlatform(ctx, plat, sim.arenaId, ppm, inkW, sim.elapsed);
    }

    // 4. Bonus iron ceiling rings / timber swing rings
    for (const anc of sim.anchors) {
      this.drawAnchorRing(ctx, anc.x, anc.y, sim.arenaId, ppm, inkW);
    }

    // 5. Foreground Hazards (barrels, crushers)
    for (const haz of sim.hazards) {
      if (haz.kind !== 'lava') {
        this.drawHazard(ctx, haz, ppm, inkW, sim.elapsed);
      }
    }

    // 5.5 King of the Platform Capture Zone
    if (sim.kingZone) {
      this.drawKingZone(ctx, sim, sim.kingZone, ppm, inkW);
    }

    // 6. Tutorial Chalk Target Zone & Waypoint
    if (options.targetZone) {
      this.drawTargetZone(ctx, options.targetZone, ppm, sim.elapsed);
    }
    if (options.waypoint) {
      this.drawWaypoint(
        ctx,
        options.waypoint.x,
        options.waypoint.y,
        options.waypoint.color ?? '#f2be5c',
        ppm,
        sim.elapsed
      );
    }

    // 6.5 Fighter Ground Contact Shadows
    for (const f of sim.fighters) {
      if (!f.alive) continue;
      this.drawFighterGroundShadow(ctx, sim, f, ppm);
    }

    // 7. Grappling Hooks & Ropes (drawn under characters' front hands)
    for (const f of sim.fighters) {
      if (f.alive && f.grapple.active) {
        this.drawGrappleHookAndRope(ctx, f, ppm, inkW, sim.elapsed);
      }
    }

    // 8. 2D Stylized Fighters
    for (const f of sim.fighters) {
      const mem = this.memories.get(f.id);
      if (mem) {
        drawFighter2D(
          ctx,
          f,
          mem,
          this.worldToScreen,
          ppm,
          sim.elapsed,
          f.isHuman ? this.humanMechPalettes : undefined
        );
      }
      if (f.alive && f.spawnInvulnTimer > 0) {
        this.drawSpawnShield(ctx, f, ppm, sim.elapsed);
      }
    }

    // 9. Pooled Inked VFX + Atmospheric foreground particles
    this.drawVfx(ctx, ppm, inkW);
    this.drawAmbientMotes(ctx, sim.arenaId, sim.elapsed);

    // 10. Floating Fighter Overhead Percentage Pips & Team Tags
    if (options.isPlaying) {
      for (const f of sim.fighters) {
        if (!f.alive) continue;
        this.drawFighterOverheadPip(ctx, sim, f, ppm);
      }

      if (options.aimWorld?.active) {
        const sp = this.worldToScreen(options.aimWorld.x, options.aimWorld.y);
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.strokeStyle = '#f4ead5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, arenaId: ArenaId, elapsed: number): void {
    const w = this.width;
    const h = this.height;
    const pxShift = -this.cam.x * 10;

    const skyKey = `${arenaId}:${w}:${h}`;
    if (this.backdropKey !== skyKey) {
      this.backdropKey = skyKey;
      this.backdropCanvas.width = w;
      this.backdropCanvas.height = h;
      const bCtx = this.backdropCtx;
      const sky = bCtx.createLinearGradient(0, 0, 0, h);
      if (arenaId === 'meadow') {
        sky.addColorStop(0, '#4f98d8');
        sky.addColorStop(0.54, '#95d2f2');
        sky.addColorStop(1, '#f7ecc9');
      } else if (arenaId === 'canopy') {
        sky.addColorStop(0, '#467ab5');
        sky.addColorStop(0.52, '#92bed9');
        sky.addColorStop(1, '#f5d79e');
      } else if (arenaId === 'islands') {
        sky.addColorStop(0, '#272947');
        sky.addColorStop(0.55, '#463759');
        sky.addColorStop(1, '#7a495c');
      } else if (arenaId === 'factory') {
        sky.addColorStop(0, '#1e1a21');
        sky.addColorStop(0.6, '#362a2a');
        sky.addColorStop(1, '#593b2c');
      } else if (arenaId === 'furnace') {
        sky.addColorStop(0, '#1f1314');
        sky.addColorStop(0.6, '#421e1a');
        sky.addColorStop(1, '#782f1e');
      } else {
        sky.addColorStop(0, '#212536');
        sky.addColorStop(0.6, '#353a50');
        sky.addColorStop(1, '#5c4d54');
      }
      bCtx.fillStyle = sky;
      bCtx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(this.backdropCanvas, 0, 0, w, h);

    if (arenaId === 'meadow' || arenaId === 'canopy') {
      const isMeadow = arenaId === 'meadow';
      // Golden sunlit rays + hand-inked sun disc
      const sunX = w * (isMeadow ? 0.78 : 0.22) + pxShift * 0.08;
      const sunY = h * 0.2;
      const sunR = Math.min(w, h) * 0.082;

      ctx.save();
      for (let r = 0; r < 5; r++) {
        ctx.fillStyle = 'rgba(255, 244, 200, 0.085)';
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        const spread = (r - 2) * 0.22;
        ctx.lineTo(sunX + Math.cos(1.15 + spread) * h * 1.4, sunY + Math.sin(1.15 + spread) * h * 1.4);
        ctx.lineTo(sunX + Math.cos(1.27 + spread) * h * 1.4, sunY + Math.sin(1.27 + spread) * h * 1.4);
        ctx.closePath();
        ctx.fill();
      }
      // Outer sun halo
      ctx.fillStyle = 'rgba(255, 232, 150, 0.38)';
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR * 1.42 + Math.sin(elapsed * 2) * 2, 0, Math.PI * 2);
      ctx.fill();

      // Sun disc
      ctx.fillStyle = isMeadow ? '#fce288' : '#f7ba63';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Drifting inked cream cumulus clouds (2-pass unified outer silhouette, zero internal seams)
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const speed = 9 + (i % 3) * 4;
        const baseX = ((i * w * 0.26 + elapsed * speed + pxShift * 0.16) % (w + 340)) - 170;
        const cy = h * (0.14 + (i % 3) * 0.085);
        const cr = 30 + (i % 2) * 11;
        const puffs: Array<[number, number, number]> = [
          [baseX, cy + 2, cr * 0.85],
          [baseX + cr * 0.78, cy - cr * 0.28, cr * 0.96],
          [baseX + cr * 1.62, cy + 4, cr * 0.78],
        ];
        const pillX = baseX - cr * 0.82;
        const pillY = cy + cr * 0.02;
        const pillW = cr * 3.18;
        const pillH = cr * 0.82;

        // Pass 1: Outer ink border silhouette
        ctx.fillStyle = INK;
        for (const [px, py, pr] of puffs) {
          ctx.beginPath();
          ctx.arc(px, py, pr + 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.roundRect(pillX - 2.5, pillY - 2.5, pillW + 5, pillH + 5, pillH * 0.5);
        ctx.fill();

        // Pass 2: Warm cream cloud body fill
        ctx.fillStyle = '#fff9ec';
        for (const [px, py, pr] of puffs) {
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillH * 0.5);
        ctx.fill();

        // Subtle curved cel-shadow along lower belly (never cutting across the center)
        ctx.fillStyle = isMeadow ? '#dcecf6' : '#efe0c8';
        ctx.beginPath();
        ctx.roundRect(
          pillX + 6,
          pillY + pillH * 0.58,
          pillW - 12,
          pillH * 0.34,
          pillH * 0.2
        );
        ctx.fill();
      }

      // Soaring distant swallow birds
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let b = 0; b < 5; b++) {
        const bx = ((b * w * 0.24 + elapsed * (24 + b * 3) + pxShift * 0.12) % (w + 180)) - 90;
        const by = h * (0.18 + (b % 3) * 0.06) + Math.sin(elapsed * 3.2 + b) * 8;
        const flap = Math.sin(elapsed * 8 + b * 1.7) * 4;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by - flap);
        ctx.quadraticCurveTo(bx - 4, by - 5, bx, by);
        ctx.quadraticCurveTo(bx + 4, by - 5, bx + 10, by - flap);
        ctx.stroke();
      }
      ctx.restore();

      // Far rolling pastoral hills + stylized trees/aqueduct
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-40, h);
      for (let x = -40; x <= w + 40; x += 40) {
        const hillY =
          h * 0.68 +
          Math.sin((x - pxShift * 0.18) * 0.0045) * 48 +
          Math.cos((x - pxShift * 0.18) * 0.011) * 20;
        ctx.lineTo(x, hillY);
      }
      ctx.lineTo(w + 40, h);
      ctx.closePath();
      ctx.fillStyle = isMeadow ? '#75b568' : '#7ba662';
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Canopy stone aqueduct arches & rotating wooden hillside windmill
      if (!isMeadow) {
        const millX = w * 0.77 + pxShift * 0.22;
        const millY = h * 0.51;
        // Aqueduct arches on left horizon
        const aqX = w * 0.12 + pxShift * 0.18;
        const aqY = h * 0.46;
        ctx.fillStyle = '#a3927d';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.fillRect(aqX, aqY, 176, 15);
        ctx.strokeRect(aqX, aqY, 176, 15);
        for (let a = 0; a < 4; a++) {
          ctx.fillRect(aqX + a * 46, aqY + 15, 16, 86);
          ctx.strokeRect(aqX + a * 46, aqY + 15, 16, 86);
          if (a < 3) {
            // Arch keystone curve between piers
            ctx.beginPath();
            ctx.moveTo(aqX + a * 46 + 16, aqY + 15);
            ctx.lineTo(aqX + (a + 1) * 46, aqY + 15);
            ctx.lineTo(aqX + (a + 1) * 46, aqY + 34);
            ctx.arc(aqX + a * 46 + 31, aqY + 34, 15, 0, Math.PI, true);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }

        // Hillside Millhouse
        ctx.fillStyle = '#e8d7b7';
        ctx.beginPath();
        ctx.moveTo(millX - 24, millY + 95);
        ctx.lineTo(millX - 16, millY - 20);
        ctx.lineTo(millX + 16, millY - 20);
        ctx.lineTo(millX + 24, millY + 95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#c45141';
        ctx.beginPath();
        ctx.moveTo(millX - 22, millY - 20);
        ctx.lineTo(millX, millY - 46);
        ctx.lineTo(millX + 22, millY - 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Spinning 4 Windmill Sails
        ctx.save();
        ctx.translate(millX, millY - 12);
        ctx.rotate(elapsed * 0.55);
        for (let s = 0; s < 4; s++) {
          ctx.rotate(Math.PI * 0.5);
          ctx.fillStyle = '#f4ead5';
          ctx.fillRect(-2, -62, 4, 62);
          ctx.strokeRect(-2, -62, 4, 62);
          ctx.fillStyle = '#e6c993';
          ctx.fillRect(2, -58, 14, 42);
          ctx.strokeRect(2, -58, 14, 42);
        }
        ctx.fillStyle = '#5c4132';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Near lush emerald meadow hills
      ctx.beginPath();
      ctx.moveTo(-40, h);
      for (let x = -40; x <= w + 40; x += 36) {
        const hillY =
          h * 0.77 +
          Math.sin((x - pxShift * 0.34) * 0.006 + 1.4) * 34 +
          Math.cos((x - pxShift * 0.34) * 0.013) * 14;
        ctx.lineTo(x, hillY);
      }
      ctx.lineTo(w + 40, h);
      ctx.closePath();
      ctx.fillStyle = isMeadow ? '#52914b' : '#5b8a4b';
      ctx.fill();
      ctx.stroke();

      // Distant storybook tree silhouettes along horizon ridge (unified outer silhouette)
      for (let t = 0; t < 7; t++) {
        const tx = ((t * w * 0.17 + pxShift * 0.25) % (w + 120)) - 60;
        const ty = h * 0.74 + Math.sin(t * 2.1) * 16;
        const puffs: Array<[number, number, number]> = [
          [tx, ty - 14, 18],
          [tx - 12, ty - 6, 13],
          [tx + 12, ty - 6, 13],
        ];
        ctx.fillStyle = INK;
        for (const [cx, cy, cr] of puffs) {
          ctx.beginPath();
          ctx.arc(cx, cy, cr + 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = isMeadow ? '#3f733d' : '#466e3d';
        for (const [cx, cy, cr] of puffs) {
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    // Twinkling hand-placed stars in upper sky for dusk/night biomes
    ctx.fillStyle = '#f4ead5';
    for (let i = 0; i < 26; i++) {
      const sx = (((i * 197 + 43) % 1000) / 1000) * w;
      const sy = (((i * 113 + 19) % 450) / 1000) * h;
      const alpha = 0.25 + 0.45 * Math.abs(Math.sin(elapsed * 1.4 + i));
      ctx.globalAlpha = alpha;
      ctx.fillRect(sx, sy, i % 3 === 0 ? 3 : 2, i % 3 === 0 ? 3 : 2);
    }
    ctx.globalAlpha = 1;

    if (arenaId === 'islands' || arenaId === 'tutorial' || arenaId === 'crucible') {
      // Painted Terracotta Crescent Moon
      const moonX = w * 0.5 + pxShift * 0.12;
      const moonY = h * 0.32;
      const moonR = Math.min(w, h) * 0.145;
      const ox = -moonR * 0.34;
      const oy = -moonR * 0.22;
      const innerR = moonR * 0.88;
      const d = Math.hypot(ox, oy);
      const a = (moonR * moonR - innerR * innerR + d * d) / (2 * d);
      const theta = Math.atan2(-oy, -ox);
      const phi1 = Math.acos(Math.max(-1, Math.min(1, a / moonR)));
      const phi2 = Math.acos(Math.max(-1, Math.min(1, (d - a) / innerR)));

      ctx.save();
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, theta - (Math.PI - phi1), theta + (Math.PI - phi1), false);
      ctx.arc(moonX + ox, moonY + oy, innerR, theta + phi2, theta - phi2, true);
      ctx.closePath();
      ctx.fillStyle = arenaId === 'islands' ? '#de656c' : '#e09a52';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();

      // Billowing painted clouds
      ctx.save();
      const cloudColor = arenaId === 'islands' ? '#c96f7b' : '#73616c';
      const cloudHi = arenaId === 'islands' ? '#e39492' : '#947e85';
      for (let i = -2; i <= 4; i++) {
        const cx = w * 0.15 + i * w * 0.22 + pxShift * 0.18;
        const cy = h * 0.64 + Math.sin(i * 1.9) * 24;
        const r = 68 + (Math.abs(i) % 3) * 22;
        ctx.fillStyle = cloudColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.7, cy + 12, r * 0.75, 0, Math.PI * 2);
        ctx.arc(cx - r * 0.65, cy + 14, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cloudHi;
        ctx.beginPath();
        ctx.arc(cx, cy - 10, r * 0.72, Math.PI, 0);
        ctx.fill();
      }
      ctx.restore();

      // Distant hand-drawn inked mountain peaks
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-40, h);
      const peaks = [
        [0.05, 0.56],
        [0.18, 0.36],
        [0.34, 0.66],
        [0.52, 0.52],
        [0.72, 0.68],
        [0.86, 0.3],
        [1.04, 0.6],
      ];
      for (const [px, py] of peaks) {
        ctx.lineTo(px * w + pxShift * 0.28, py * h);
      }
      ctx.lineTo(w + 40, h);
      ctx.closePath();
      ctx.fillStyle = arenaId === 'islands' ? '#4a3d61' : '#2a2d3d';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();

      if (arenaId === 'tutorial' || arenaId === 'crucible') {
        for (let i = 0; i < 4; i++) {
          const lx = w * (0.16 + i * 0.22) + pxShift * 0.45;
          const ly = h * 0.14 + Math.sin(elapsed * 1.5 + i) * 6;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(lx, ly);
          ctx.stroke();

          ctx.fillStyle = '#e89d4a';
          ctx.beginPath();
          ctx.ellipse(lx, ly + 13, 11, 15, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f8d58c';
          ctx.beginPath();
          ctx.ellipse(lx - 2, ly + 11, 5, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#382924';
          ctx.fillRect(lx - 7, ly - 2, 14, 4);
          ctx.strokeRect(lx - 7, ly - 2, 14, 4);
          ctx.fillRect(lx - 6, ly + 26, 12, 4);
          ctx.strokeRect(lx - 6, ly + 26, 12, 4);
        }
      }
      ctx.restore();
    } else if (arenaId === 'factory') {
      ctx.save();
      ctx.fillStyle = '#292126';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const gx = w * (0.2 + i * 0.3) + pxShift * 0.22;
        const gy = h * (0.42 + (i % 2) * 0.14);
        const rad = 75 + i * 18;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(elapsed * (i % 2 === 0 ? 0.25 : -0.2));
        ctx.beginPath();
        for (let t = 0; t < 10; t++) {
          const a = (t / 10) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          ctx.lineTo(Math.cos(a + 0.16) * (rad + 14), Math.sin(a + 0.16) * (rad + 14));
          ctx.lineTo(Math.cos(a + 0.36) * (rad + 14), Math.sin(a + 0.36) * (rad + 14));
          ctx.lineTo(Math.cos(a + 0.48) * rad, Math.sin(a + 0.48) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < 4; i++) {
        const wx = w * (0.14 + i * 0.24) + pxShift * 0.15;
        ctx.fillStyle = 'rgba(224, 159, 62, 0.18)';
        ctx.beginPath();
        ctx.roundRect(wx - 28, h * 0.26, 56, 130, [28, 28, 4, 4]);
        ctx.fill();
      }
      ctx.restore();
    } else if (arenaId === 'furnace') {
      ctx.save();
      ctx.fillStyle = '#2e1817';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const bx = w * (0.08 + i * 0.18) + pxShift * 0.25;
        ctx.beginPath();
        ctx.moveTo(bx - 60, h);
        ctx.lineTo(bx - 12, h * (0.28 + (i % 3) * 0.12));
        ctx.lineTo(bx + 24, h * (0.34 + (i % 2) * 0.14));
        ctx.lineTo(bx + 70, h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawOverworldTentAndCamp(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    ppm: number,
    inkW: number,
    elapsed: number
  ): void {
    const base = this.worldToScreen(wx, wy);
    const u = ppm;
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Crossed timber tent ridge poles + fluttering crimson pennant
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, 0.09 * u);
    ctx.beginPath();
    ctx.moveTo(-1.35 * u, 0);
    ctx.lineTo(-0.08 * u, -2.02 * u);
    ctx.moveTo(1.35 * u, 0);
    ctx.lineTo(0.08 * u, -2.02 * u);
    ctx.stroke();

    ctx.strokeStyle = '#734b2f';
    ctx.lineWidth = Math.max(1.5, 0.05 * u);
    ctx.stroke();

    // Taut guy-ropes & ground stakes
    ctx.strokeStyle = '#3b2e26';
    ctx.lineWidth = Math.max(1.4, inkW * 0.65);
    ctx.beginPath();
    ctx.moveTo(-1.05 * u, -0.82 * u);
    ctx.lineTo(-1.68 * u, 0.02 * u);
    ctx.moveTo(1.05 * u, -0.82 * u);
    ctx.lineTo(1.68 * u, 0.02 * u);
    ctx.stroke();

    // Main sunlit striped canvas tent body
    ctx.beginPath();
    ctx.moveTo(-1.3 * u, 0);
    ctx.lineTo(-0.72 * u, -1.05 * u);
    ctx.lineTo(0, -1.88 * u);
    ctx.lineTo(0.72 * u, -1.05 * u);
    ctx.lineTo(1.3 * u, 0);
    ctx.closePath();
    ctx.fillStyle = '#e8ba68';
    ctx.fill();
    ctx.lineWidth = inkW;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Terracotta expedition stripe panels
    ctx.beginPath();
    ctx.moveTo(-0.85 * u, 0);
    ctx.lineTo(-0.46 * u, -0.95 * u);
    ctx.lineTo(0, -1.84 * u);
    ctx.lineTo(0.46 * u, -0.95 * u);
    ctx.lineTo(0.85 * u, 0);
    ctx.closePath();
    ctx.fillStyle = '#d46246';
    ctx.fill();
    ctx.stroke();

    // Dark cozy tent doorway opening + warm interior lantern glow
    ctx.beginPath();
    ctx.moveTo(-0.45 * u, 0);
    ctx.quadraticCurveTo(0, -1.25 * u, 0.45 * u, 0);
    ctx.closePath();
    ctx.fillStyle = '#241c24';
    ctx.fill();
    ctx.stroke();

    const flicker = 0.85 + Math.sin(elapsed * 9) * 0.15;
    ctx.fillStyle = `rgba(247, 198, 92, ${0.42 * flicker})`;
    ctx.beginPath();
    ctx.arc(0, -0.35 * u, 0.25 * u, 0, Math.PI * 2);
    ctx.fill();

    // Rolled-up side flaps
    ctx.fillStyle = '#f2dec0';
    ctx.beginPath();
    ctx.ellipse(-0.48 * u, -0.45 * u, 0.1 * u, 0.34 * u, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fluttering apex pennant
    const wave = Math.sin(elapsed * 6.5) * 0.08 * u;
    ctx.beginPath();
    ctx.moveTo(0, -1.88 * u);
    ctx.lineTo(0, -2.35 * u);
    ctx.lineTo(0.48 * u, -2.22 * u + wave);
    ctx.lineTo(0, -2.06 * u);
    ctx.closePath();
    ctx.fillStyle = '#d94e34';
    ctx.fill();
    ctx.stroke();

    // Cozy miniature stone campfire ring & curl of smoke beside tent
    const fx = 2.05 * u;
    ctx.fillStyle = '#8a7f78';
    for (let s = -2; s <= 2; s++) {
      ctx.beginPath();
      ctx.arc(fx + s * 0.1 * u, 0.02 * u, 0.075 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#f0923c';
    ctx.beginPath();
    ctx.moveTo(fx - 0.14 * u, 0);
    ctx.quadraticCurveTo(fx, -0.36 * u - Math.sin(elapsed * 12) * 0.06 * u, fx + 0.14 * u, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let sm = 0; sm < 3; sm++) {
      const t = ((elapsed * 0.45 + sm * 0.33) % 1);
      ctx.globalAlpha = (1 - t) * 0.45;
      ctx.fillStyle = '#f7f2e8';
      ctx.beginPath();
      ctx.arc(
        fx + Math.sin(elapsed * 2 + sm * 2) * 0.12 * u,
        (-0.45 - t * 1.1) * u,
        (0.08 + t * 0.12) * u,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawPlatform(
    ctx: CanvasRenderingContext2D,
    plat: PlatformRect,
    arenaId: ArenaId,
    ppm: number,
    inkW: number,
    elapsed: number
  ): void {
    const tl = this.worldToScreen(plat.x - plat.w * 0.5, plat.y + plat.h * 0.5);
    const pw = plat.w * ppm;
    const ph = plat.h * ppm;

    let shakeX = 0;
    if (plat.kind === 'crumbling' && (plat.crumbleTimer ?? 0) > 0) {
      shakeX = Math.sin(elapsed * 55) * 3.5;
    }

    ctx.save();
    ctx.translate(tl.x + shakeX, tl.y);

    if (plat.kind === 'destructible') {
      ctx.fillStyle = plat.color;
      ctx.beginPath();
      ctx.roundRect(0, 0, pw, ph, 5);
      ctx.fill();
      ctx.lineWidth = inkW;
      ctx.strokeStyle = INK;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(4, 4);
      ctx.lineTo(pw - 4, ph - 4);
      ctx.moveTo(pw - 4, 4);
      ctx.lineTo(4, ph - 4);
      ctx.strokeRect(5, 5, pw - 10, ph - 10);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Giant Toadstool Cap Platforms in Toadstool Glade ('canopy')
    if (arenaId === 'canopy' && plat.id.startsWith('can-shroom')) {
      // Cream mushroom stalk descending below cap with rounded bulbous foot
      const stalkW = Math.min(pw * 0.24, 1.05 * ppm);
      const stalkH = plat.id === 'can-shroom-top' ? 1.55 * ppm : 2.1 * ppm;
      const sx = (pw - stalkW) * 0.5;
      ctx.fillStyle = '#efe0bf';
      ctx.strokeStyle = INK;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.roundRect(sx, ph * 0.65, stalkW, stalkH, [4, 4, stalkW * 0.45, stalkW * 0.45]);
      ctx.fill();
      ctx.stroke();

      // Subtle shaded volva ring at base of stalk
      ctx.fillStyle = '#dcc599';
      ctx.beginPath();
      ctx.ellipse(pw * 0.5, ph * 0.65 + stalkH - 6, stalkW * 0.48, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Gill ridges under cap
      ctx.fillStyle = '#e5cf9c';
      ctx.beginPath();
      ctx.roundRect(6, ph * 0.5, pw - 12, ph * 0.45, 6);
      ctx.fill();
      ctx.stroke();

      // Crimson rounded toadstool dome cap
      ctx.fillStyle = '#d65143';
      ctx.beginPath();
      ctx.roundRect(0, 0, pw, ph * 0.72, [ph * 0.55, ph * 0.55, 6, 6]);
      ctx.fill();
      ctx.stroke();

      // Cream spots along dome
      ctx.fillStyle = '#fbf0d4';
      const spotCount = Math.max(3, Math.floor(plat.w));
      for (let i = 0; i < spotCount; i++) {
        const spX = ((i + 0.65) / (spotCount + 0.3)) * pw;
        const spY = ph * (0.24 + (i % 2) * 0.14);
        ctx.beginPath();
        ctx.ellipse(spX, spY, 7 + (i % 2) * 3, 5 + (i % 2) * 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Platform main block body
    ctx.fillStyle = plat.color;
    ctx.beginPath();
    ctx.roundRect(0, 0, pw, ph, plat.kind === 'passthrough' ? 4 : 6);
    ctx.fill();

    // Subtle lower shadow band (2D cel shading)
    ctx.fillStyle = 'rgba(14, 10, 20, 0.24)';
    ctx.fillRect(2, ph * 0.56, Math.max(0, pw - 4), ph * 0.4);

    // Biome Top Rim Details
    if (plat.kind === 'conveyor') {
      ctx.fillStyle = '#d49a47';
      ctx.fillRect(0, 0, pw, Math.min(8, ph * 0.26));
      const speed = plat.conveyorSpeed ?? 4;
      const offset = ((elapsed * speed * ppm * 0.5) % 24 + 24) % 24;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let x = offset - 24; x < pw; x += 24) {
        if (x < 4 || x > pw - 6) continue;
        const dir = Math.sign(speed);
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x + dir * 5, 5);
        ctx.lineTo(x, 8);
        ctx.stroke();
      }
    } else if ((arenaId === 'meadow' || arenaId === 'canopy') && plat.kind === 'solid') {
      // Pebbles inside earthen soil
      ctx.fillStyle = 'rgba(244, 234, 213, 0.18)';
      for (let px = 18; px < pw - 18; px += 34) {
        ctx.beginPath();
        ctx.ellipse(px, ph * 0.62 + ((px % 11) - 5), 6, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Scalloped lush emerald grass cap
      const turfH = Math.min(13, ph * 0.34);
      ctx.fillStyle = arenaId === 'meadow' ? '#63a84f' : '#6b9c49';
      ctx.fillRect(0, 0, pw, turfH);
      ctx.beginPath();
      for (let gx = 10; gx < pw - 8; gx += 18) {
        ctx.arc(gx, turfH, 6.5, 0, Math.PI);
      }
      ctx.fill();
      ctx.fillStyle = '#8bd164';
      ctx.fillRect(2, 1, Math.max(0, pw - 4), 4);
    } else if (arenaId === 'islands' && plat.kind !== 'passthrough') {
      ctx.fillStyle = '#9b90a8';
      ctx.fillRect(0, 0, pw, Math.min(11, ph * 0.28));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      for (let x = 18; x < pw - 14; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, Math.min(11, ph * 0.28));
        ctx.stroke();
      }
    } else if (plat.kind === 'passthrough') {
      ctx.fillStyle = arenaId === 'meadow' ? '#c9935b' : '#b89a78';
      ctx.fillRect(0, 0, pw, Math.min(6, ph * 0.35));
      if (arenaId === 'meadow' && plat.id.startsWith('mdw-bridge')) {
        // Wooden bridge plank lines
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        for (let x = 14; x < pw - 10; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ph);
          ctx.stroke();
        }
      }
    }

    // Diagonal ink cross-hatch marks under wide platforms
    if (plat.w >= 4 && ph >= 14) {
      ctx.strokeStyle = 'rgba(18, 14, 23, 0.36)';
      ctx.lineWidth = 1.5;
      for (let x = 14; x < pw - 14; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, ph * 0.65);
        ctx.lineTo(x - 6, ph - 2);
        ctx.stroke();
      }
    }

    // Thick hand-inked border
    ctx.lineWidth = inkW;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.roundRect(0, 0, pw, ph, plat.kind === 'passthrough' ? 4 : 6);
    ctx.stroke();

    // Swaying Grass Tufts & Colorful Wildflowers along solid Overworld/Glade lawns!
    if ((arenaId === 'meadow' || arenaId === 'canopy') && plat.kind === 'solid' && plat.w >= 4) {
      const seedBase = plat.id.charCodeAt(plat.id.length - 1) || 7;
      const flowerColors = ['#ffffff', '#e85d50', '#f5cb52', '#a87de0'];
      for (let gx = 16; gx < pw - 16; gx += 22) {
        const sway = Math.sin(elapsed * 2.7 + gx * 0.08 + seedBase) * 3;
        ctx.strokeStyle = '#36662c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx - 3 + sway * 0.7, -8);
        ctx.moveTo(gx + 3, 0);
        ctx.lineTo(gx + 5 + sway, -10);
        ctx.stroke();

        // Plant wildflowers on deterministic intervals
        if (((Math.floor(gx / 22) + seedBase) % 3) === 0) {
          const fx = gx + 1 + sway * 0.85;
          const fy = -11;
          const col = flowerColors[(Math.floor(gx / 22) + seedBase) % flowerColors.length];
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.3;
          ctx.fillStyle = col;
          for (let p = 0; p < 5; p++) {
            const pa = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(fx + Math.cos(pa) * 3.8, fy + Math.sin(pa) * 3.8, 2.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = '#f5b83d';
          ctx.beginPath();
          ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private drawAnchorRing(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    arenaId: ArenaId,
    ppm: number,
    inkW: number
  ): void {
    const p = this.worldToScreen(wx, wy);
    const r = Math.max(8, 0.26 * ppm);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = arenaId === 'meadow' || arenaId === 'canopy' ? '#7a5438' : '#6c5a52';
    ctx.strokeStyle = INK;
    ctx.lineWidth = inkW;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0a958';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawKingZone(
    ctx: CanvasRenderingContext2D,
    sim: SimulationState,
    zone: KingZoneState,
    ppm: number,
    inkW: number
  ): void {
    const tl = this.worldToScreen(zone.x - zone.w * 0.5, zone.y + zone.h * 0.5);
    const zw = zone.w * ppm;
    const zh = zone.h * ppm;
    const holder =
      zone.controllerId !== null ? sim.fighters.find((f) => f.id === zone.controllerId) : null;
    const zoneColor = zone.contested
      ? '#d95d43'
      : holder
        ? holder.archetype.primaryColor
        : '#e8b84b';

    ctx.save();
    ctx.translate(tl.x, tl.y);
    ctx.fillStyle = zone.contested
      ? 'rgba(217, 93, 67, 0.24)'
      : holder
        ? 'rgba(110, 181, 164, 0.24)'
        : 'rgba(232, 184, 75, 0.22)';
    ctx.beginPath();
    ctx.roundRect(0, 0, zw, zh, 8);
    ctx.fill();

    ctx.strokeStyle = zoneColor;
    ctx.lineWidth = 2.6;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Twin golden banner poles flanking the capture zone
    for (const bx of [2, zw - 2]) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = inkW;
      ctx.beginPath();
      ctx.moveTo(bx, zh);
      ctx.lineTo(bx, -14);
      ctx.stroke();

      ctx.fillStyle = zoneColor;
      ctx.beginPath();
      ctx.arc(bx, -16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Crown badge & label above zone
    const label = zone.contested
      ? 'CONTESTED!'
      : holder
        ? `${holder.name} · ${Math.round(holder.kingScore)}%`
        : 'KING ZONE';
    ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = INK;
    ctx.strokeText(label, zw * 0.5, -10);
    ctx.fillStyle = zoneColor;
    ctx.fillText(label, zw * 0.5, -10);

    ctx.restore();
  }

  private drawFighterGroundShadow(
    ctx: CanvasRenderingContext2D,
    sim: SimulationState,
    f: FighterState,
    ppm: number
  ): void {
    let bestTop = -Infinity;
    for (const plat of sim.platforms) {
      if (plat.broken) continue;
      const left = plat.x - plat.w * 0.5;
      const right = plat.x + plat.w * 0.5;
      const top = plat.y + plat.h * 0.5;
      if (f.x >= left - 0.2 && f.x <= right + 0.2 && top <= f.y + 0.15 && top > bestTop) {
        bestTop = top;
      }
    }
    if (!Number.isFinite(bestTop)) return;
    const heightAbove = f.y - bestTop;
    if (heightAbove > 4.2 || heightAbove < -0.1) return;

    const sp = this.worldToScreen(f.x, bestTop);
    const scale = Math.max(0.35, 1 - heightAbove / 4.5);
    ctx.save();
    ctx.globalAlpha = 0.28 * scale;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y + 1, 0.42 * ppm * scale, 0.1 * ppm * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSpawnShield(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    ppm: number,
    elapsed: number
  ): void {
    const sp = this.worldToScreen(f.x, f.y + f.height * 0.5);
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.2 * Math.sin(elapsed * 18);
    ctx.strokeStyle = '#f4ead5';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 0.92 * ppm, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawAmbientMotes(ctx: CanvasRenderingContext2D, arenaId: ArenaId, elapsed: number): void {
    const w = this.width;
    const h = this.height;
    ctx.save();
    if (arenaId === 'meadow' || arenaId === 'canopy') {
      // Drifting dandelion seeds & sunlit flower petals
      for (let i = 0; i < 16; i++) {
        const mx = ((i * 173 + elapsed * (22 + (i % 4) * 6)) % (w + 40)) - 20;
        const my = ((i * 97 + Math.sin(elapsed * 1.4 + i) * 32 + elapsed * 10) % h);
        ctx.fillStyle = arenaId === 'meadow'
          ? i % 3 === 0 ? '#fff9e6' : i % 3 === 1 ? '#f7d560' : '#f49ca8'
          : i % 2 === 0 ? '#f4c55c' : '#e07a5f';
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.ellipse(mx, my, 3.2, 2.0, elapsed + i, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (arenaId === 'furnace') {
      // Rising glowing embers
      for (let i = 0; i < 18; i++) {
        const mx = ((i * 151 + Math.sin(elapsed * 2 + i) * 24) % w);
        const my = h - ((i * 83 + elapsed * (48 + (i % 5) * 14)) % h);
        ctx.fillStyle = i % 2 === 0 ? '#f7b248' : '#e35d34';
        ctx.globalAlpha = 0.65;
        ctx.fillRect(mx, my, 3, 3);
      }
    } else if (arenaId === 'factory') {
      for (let i = 0; i < 12; i++) {
        const mx = ((i * 211 + elapsed * 18) % w);
        const my = ((i * 107 + elapsed * 24) % h);
        ctx.fillStyle = '#e8b366';
        ctx.globalAlpha = 0.45;
        ctx.fillRect(mx, my, 2.5, 2.5);
      }
    } else {
      // Dusk fireflies / twilight motes
      for (let i = 0; i < 14; i++) {
        const mx = ((i * 187 + Math.sin(elapsed * 1.2 + i) * 28) % w);
        const my = ((i * 119 + Math.cos(elapsed * 1.1 + i * 2) * 22) % h);
        ctx.fillStyle = '#f2be5c';
        ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(elapsed * 2.5 + i));
        ctx.beginPath();
        ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawHazard(
    ctx: CanvasRenderingContext2D,
    haz: HazardZone,
    ppm: number,
    inkW: number,
    elapsed: number
  ): void {
    if (haz.kind === 'barrel' && haz.exploded) return;

    const tl = this.worldToScreen(haz.x - haz.w * 0.5, haz.y + haz.h * 0.5);
    const pw = haz.w * ppm;
    const ph = haz.h * ppm;

    ctx.save();
    ctx.translate(tl.x, tl.y);

    if (haz.kind === 'lava') {
      const grad = ctx.createLinearGradient(0, 0, 0, ph);
      grad.addColorStop(0, '#eb6e34');
      grad.addColorStop(0.35, '#c93e24');
      grad.addColorStop(1, '#5e1a14');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, ph);
      ctx.lineTo(0, 6);
      for (let x = 0; x <= pw; x += 28) {
        const wave = Math.sin(elapsed * 4 + x * 0.05) * 4;
        ctx.lineTo(x, wave);
      }
      ctx.lineTo(pw, ph);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = inkW;
      ctx.strokeStyle = '#ffd180';
      ctx.stroke();
    } else if (haz.kind === 'crusher') {
      if (haz.warningTimer > 0) {
        ctx.fillStyle = 'rgba(219, 86, 62, 0.25)';
        ctx.fillRect(2, ph, pw - 4, 8.5 * ppm);
      }
      ctx.fillStyle = haz.active ? '#c94c38' : '#574a4e';
      ctx.beginPath();
      ctx.roundRect(0, 0, pw, ph, 5);
      ctx.fill();
      ctx.lineWidth = inkW;
      ctx.strokeStyle = INK;
      ctx.stroke();

      ctx.fillStyle = '#e0a43a';
      for (let x = 8; x < pw - 16; x += 22) {
        ctx.fillRect(x, ph - 10, 12, 6);
      }
    } else if (haz.kind === 'barrel') {
      ctx.fillStyle = '#b53d2e';
      ctx.beginPath();
      ctx.roundRect(0, 0, pw, ph, 8);
      ctx.fill();
      ctx.lineWidth = inkW;
      ctx.strokeStyle = INK;
      ctx.stroke();

      ctx.fillStyle = '#e6b85c';
      ctx.fillRect(2, ph * 0.25, pw - 4, 5);
      ctx.fillRect(2, ph * 0.68, pw - 4, 5);
    }

    ctx.restore();
  }

  private drawGrappleHookAndRope(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    ppm: number,
    inkW: number,
    elapsed: number
  ): void {
    const start = this.worldToScreen(f.x + f.facing * 0.18, f.y + 0.92);
    const end = this.worldToScreen(f.grapple.hookX, f.grapple.hookY);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distPx = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    const segs = f.grapple.phase === 'firing' ? 14 : 6;
    const nx = -dy / distPx;
    const ny = dx / distPx;

    const strokeRope = (strokeStyle: string, width: number) => {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        let offset = 0;
        if (f.grapple.phase === 'firing') {
          offset = Math.sin(t * Math.PI * 3 - elapsed * 28) * (1 - t) * 10;
        } else {
          offset = Math.sin(t * Math.PI) * 2.2;
        }
        ctx.lineTo(start.x + dx * t + nx * offset, start.y + dy * t + ny * offset);
      }
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    strokeRope(INK, Math.max(4.5, ppm * 0.14));
    strokeRope('#e3caa1', Math.max(2.2, ppm * 0.075));

    const hs = Math.max(9, ppm * 0.34);
    ctx.translate(end.x, end.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#d1cac2';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.8, inkW * 0.85);

    ctx.beginPath();
    ctx.roundRect(-hs * 0.65, -hs * 0.15, hs * 0.85, hs * 0.3, 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hs * 0.15, 0);
    ctx.quadraticCurveTo(hs * 0.65, -hs * 0.72, -hs * 0.15, -hs * 0.66);
    ctx.lineTo(hs * 0.12, -hs * 0.36);
    ctx.lineTo(hs * 0.56, 0);
    ctx.lineTo(hs * 0.12, hs * 0.36);
    ctx.lineTo(-hs * 0.15, hs * 0.66);
    ctx.quadraticCurveTo(hs * 0.65, hs * 0.72, hs * 0.15, 0);
    ctx.closePath();
    ctx.fillStyle = f.grapple.phase === 'attached' ? '#ebe4d8' : '#f2be5c';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawWaypoint(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    color: string,
    ppm: number,
    elapsed: number
  ): void {
    const p = this.worldToScreen(wx, wy + Math.sin(elapsed * 3.4) * 0.18);
    const r = Math.max(18, ppm * 0.62);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(elapsed * 1.1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.setLineDash([10, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(-elapsed * 2.2);
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.36);
    ctx.lineTo(r * 0.36, 0);
    ctx.lineTo(0, r * 0.36);
    ctx.lineTo(-r * 0.36, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawTargetZone(
    ctx: CanvasRenderingContext2D,
    zone: { x: number; y: number; w: number; h: number; label?: string },
    ppm: number,
    elapsed: number
  ): void {
    const tl = this.worldToScreen(zone.x - zone.w * 0.5, zone.y + zone.h * 0.5);
    const zw = zone.w * ppm;
    const zh = zone.h * ppm;
    const pulse = 0.22 + 0.08 * Math.sin(elapsed * 4.0);

    ctx.save();
    ctx.translate(tl.x, tl.y);
    ctx.fillStyle = `rgba(232, 168, 72, ${pulse})`;
    ctx.beginPath();
    ctx.roundRect(0, 0, zw, zh, 6);
    ctx.fill();

    ctx.strokeStyle = '#f4ead5';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (zone.label) {
      ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.strokeText(zone.label, zw * 0.5, -6);
      ctx.fillStyle = '#f2be5c';
      ctx.fillText(zone.label, zw * 0.5, -6);
    }
    ctx.restore();
  }

  private drawVfx(ctx: CanvasRenderingContext2D, ppm: number, inkW: number): void {
    for (let i = 0; i < VFX_POOL_SIZE; i++) {
      const v = this.vfxPool[i];
      if (!v.active) continue;
      const ratio = Math.max(0, v.life / v.maxLife);
      const p = this.worldToScreen(v.x, v.y);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = Math.min(1, ratio * 1.35);

      if (v.kind === 'ring') {
        const rad = (0.35 + (1 - ratio) * v.maxSize) * ppm;
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(4, ppm * 0.2 * ratio);
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = v.color;
        ctx.lineWidth = Math.max(2, ppm * 0.11 * ratio);
        ctx.stroke();
      } else if (v.kind === 'ko_beam') {
        const wPx = v.maxSize * ppm * ratio;
        ctx.fillStyle = v.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = inkW;
        ctx.fillRect(-wPx * 0.5, -this.height, wPx, this.height * 2);
        ctx.strokeRect(-wPx * 0.5, -this.height, wPx, this.height * 2);
      } else if (v.kind === 'starburst') {
        const rad = v.size * ppm * (0.6 + (1 - ratio) * 0.9);
        ctx.rotate(v.angle);
        ctx.fillStyle = v.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1.5, inkW * 0.8);
        ctx.beginPath();
        for (let k = 0; k < 12; k++) {
          const r = k % 2 === 0 ? rad : rad * 0.38;
          const a = (k / 12) * Math.PI * 2;
          if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (v.kind === 'dust') {
        const rad = v.size * ppm * (0.45 + (1 - ratio) * 0.75);
        ctx.fillStyle = v.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1.4, inkW * 0.65);
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        const rad = v.size * ppm * ratio;
        ctx.rotate(v.angle);
        ctx.fillStyle = v.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1.2, inkW * 0.6);
        ctx.beginPath();
        ctx.moveTo(-rad, 0);
        ctx.lineTo(0, -rad * 0.45);
        ctx.lineTo(rad * 1.2, 0);
        ctx.lineTo(0, rad * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawFighterOverheadPip(
    ctx: CanvasRenderingContext2D,
    sim: SimulationState,
    f: FighterState,
    ppm: number
  ): void {
    const top = this.worldToScreen(f.x, f.y + f.height + 0.52);
    const dmg = `${Math.round(f.damagePercent)}%`;
    const teamTag =
      sim.gameMode === 'team_chaos' && f.teamId !== null
        ? f.teamId === 0
          ? 'RED'
          : 'TEAL'
        : null;
    const tag = f.isHuman
      ? teamTag
        ? `P${f.playerSlot + 1}·${teamTag}`
        : `P${f.playerSlot + 1}`
      : teamTag ?? 'CPU';

    const tagColor =
      teamTag === 'RED'
        ? '#e86f5e'
        : teamTag === 'TEAL'
          ? '#6eb5a4'
          : f.isHuman
            ? '#f2be5c'
            : f.archetype.accentColor;

    ctx.save();
    ctx.translate(top.x, top.y);
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.strokeText(dmg, 0, 0);
    ctx.fillStyle = f.damagePercent >= 120 ? '#e36b5b' : '#f4ead5';
    ctx.fillText(dmg, 0, 0);

    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
    ctx.strokeText(tag, 0, -13);
    ctx.fillStyle = tagColor;
    ctx.fillText(tag, 0, -13);

    // King crown badge if holding the crown zone
    if (sim.kingZone?.controllerId === f.id) {
      ctx.fillStyle = '#f2be5c';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-7, -23);
      ctx.lineTo(-9, -31);
      ctx.lineTo(-3, -27);
      ctx.lineTo(0, -33);
      ctx.lineTo(3, -27);
      ctx.lineTo(9, -31);
      ctx.lineTo(7, -23);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle =
      teamTag === 'RED'
        ? '#e86f5e'
        : teamTag === 'TEAL'
          ? '#6eb5a4'
          : f.isHuman
            ? '#f2be5c'
            : f.archetype.primaryColor;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, 5);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    void ppm;
  }

  public dispose(): void {
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}

import { computeAiInput } from './ai';
import { soundEngine } from './audio';
import { createArenaConfig, MECH_DEFINITIONS } from './constants';
import { EquippedMechPalettes, resolveMechColors } from './missions';
import type { RoomStatePayload } from './netTypes';
import { onlineClient } from './onlineClient';
import { buildMatchResult, createSimulation, EMPTY_INPUT, stepSimulation } from './physics';
import { Renderer2D } from './renderer2d';
import { applyReplayFrameToSim, ReplayFrame, ReplayRecorder } from './replay';
import {
  ActiveScenarioSetup,
  createTutorialRunner,
  getTutorialSnapshot,
  jumpRunnerToLevel,
  TutorialRunner,
  updateTutorialRunner,
} from './tutorial';
import {
  ArenaId,
  GameMode,
  GameScreenState,
  Handedness,
  HudFighterSummary,
  KingZoneState,
  MatchResultSummary,
  MechId,
  PlayerInput,
  SimEvent,
  SimulationState,
  TutorialMode,
  TutorialStepSnapshot,
} from './types';

export interface HudMatchMeta {
  gameMode: GameMode;
  timeLimitSeconds: number | null;
  teamScores: [number, number];
  kingZone: KingZoneState | null;
  p1EliminatedEarly: boolean;
  spectatorFast: boolean;
  onlineMode: boolean;
}

export interface ReplaySnapshot {
  frameIndex: number;
  totalFrames: number;
  currentTime: number;
  totalDuration: number;
  paused: boolean;
  speed: 0.5 | 1 | 2;
  koTimes: number[];
  startOffsetTime: number;
}

export interface EngineCallbacks {
  onHudUpdate: (
    fighters: HudFighterSummary[],
    elapsed: number,
    escalation: number,
    meta: HudMatchMeta
  ) => void;
  onMechBanner: (fighterName: string, mechId: MechId, color: string) => void;
  onMatchOver: (result: MatchResultSummary) => void;
  onTutorialUpdate?: (snapshot: TutorialStepSnapshot | null) => void;
  onReplayUpdate?: (snapshot: ReplaySnapshot | null) => void;
  onSimEvents?: (
    events: SimEvent[],
    humanFighterIds: number[],
    isTutorial: boolean
  ) => void;
}

export interface MatchSetup {
  arenaId: ArenaId;
  gameMode: GameMode;
  fighterCount: number;
  p1ArchetypeId: string;
  p2Enabled: boolean;
  p2ArchetypeId: string;
}

const FIXED_DT = 1 / 60;
const BUFFER_WINDOW = 0.11;

function detectSoftwareRenderer(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class ChaosEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: Renderer2D;
  private resizeObserver: ResizeObserver;

  private sim: SimulationState;
  private tutorialRunner: TutorialRunner | null = null;
  private lastSetup: MatchSetup;

  private screenState: GameScreenState = 'title';
  private handedness: Handedness = 'right';
  private p2Enabled = false;
  private isSoftware = detectSoftwareRenderer();
  private frameId = 0;
  private timerId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private accumulator = 0;
  private hudThrottle = 0;

  // Replay & Slow-mo Finish & Spectator state
  private replayRecorder = new ReplayRecorder(1350);
  private replayCursor = 0;
  private replayTimer = 0;
  private replayPaused = false;
  private replaySpeed: 0.5 | 1 | 2 = 1;
  private finishSlowMoActive = false;
  private finishSlowMoTimer = 0;
  private spectatorFast = false;
  private equippedMechPalettes: EquippedMechPalettes = {};

  // Online client mirror state
  private onlineMode = false;
  private localOnlineSlot = 0;
  private onlineInputTimer = 0;
  private pendingOnlineEdges = {
    jumpPressed: false,
    dashPressed: false,
    slidePressed: false,
    grapplePressed: false,
    divePressed: false,
    attackPressed: false,
  };

  // Input & snappy 0.11s action buffers
  private keysDown = new Set<string>();
  private keysJustPressed = new Set<string>();
  private mouseJustLeft = false;
  private mouseJustRight = false;
  private mouseRightHeld = false;
  private pointerClient = { x: 0, y: 0, active: false };
  private buffers = {
    jump: 0,
    dash: 0,
    slide: 0,
    grapple: 0,
    attack: 0,
    dive: 0,
  };

  constructor(
    container: HTMLElement,
    initialSetup: MatchSetup,
    callbacks: EngineCallbacks,
    initialHandedness: Handedness = 'right'
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.lastSetup = { ...initialSetup };
    this.handedness = initialHandedness;

    this.renderer = new Renderer2D(container);

    this.sim = createSimulation({ ...initialSetup, demoMode: true });
    this.renderer.resetMemories(this.sim.fighters);
    soundEngine.setMusicTheme(this.sim.arenaId, true);

    this.resizeObserver = new ResizeObserver(() => {
      this.renderer.resize(this.container.clientWidth, this.container.clientHeight);
    });
    this.resizeObserver.observe(this.container);

    this.attachListeners();
    this.lastTime = performance.now();
    this.scheduleNextTick();
  }

  public setHandedness(h: Handedness): void {
    this.handedness = h;
    if (this.tutorialRunner) {
      this.tutorialRunner.handedness = h;
      this.callbacks.onTutorialUpdate?.(getTutorialSnapshot(this.tutorialRunner));
    }
  }

  public setEquippedMechPalettes(palettes: EquippedMechPalettes): void {
    this.equippedMechPalettes = { ...palettes };
    this.renderer.setHumanMechPalettes(palettes);
  }

  public startDemoArena(setup: MatchSetup): void {
    this.lastSetup = { ...setup };
    this.screenState = 'title';
    this.p2Enabled = false;
    this.onlineMode = false;
    this.finishSlowMoActive = false;
    this.spectatorFast = false;
    this.tutorialRunner = null;
    this.callbacks.onTutorialUpdate?.(null);
    this.callbacks.onReplayUpdate?.(null);
    this.sim = createSimulation({ ...setup, demoMode: true });
    this.renderer.resetMemories(this.sim.fighters);
    soundEngine.setMusicTheme(this.sim.arenaId, true);
  }

  public startMatch(setup: MatchSetup): void {
    this.lastSetup = { ...setup };
    this.screenState = 'playing';
    this.p2Enabled = setup.p2Enabled;
    this.onlineMode = false;
    this.finishSlowMoActive = false;
    this.finishSlowMoTimer = 0;
    this.spectatorFast = false;
    this.tutorialRunner = null;
    this.replayRecorder.reset();
    this.callbacks.onTutorialUpdate?.(null);
    this.callbacks.onReplayUpdate?.(null);
    this.clearInputs();
    this.sim = createSimulation({ ...setup, demoMode: false });
    this.renderer.resetMemories(this.sim.fighters);
    soundEngine.setMusicTheme(this.sim.arenaId, false);
    this.pushHudSnapshot();
  }

  public startOnlineMatch(room: RoomStatePayload, mySlot: number): void {
    this.onlineMode = true;
    this.localOnlineSlot = mySlot;
    this.p2Enabled = false;
    this.screenState = 'playing';
    this.finishSlowMoActive = false;
    this.spectatorFast = false;
    this.tutorialRunner = null;
    this.replayRecorder.reset();
    this.callbacks.onTutorialUpdate?.(null);
    this.callbacks.onReplayUpdate?.(null);
    this.clearInputs();

    const fighterCount = room.settings.fillWithBots
      ? Math.max(2, room.settings.maxPlayers)
      : Math.max(2, room.players.length);

    const sortedPlayers = [...room.players].sort((a, b) => a.slot - b.slot);
    this.sim = createSimulation({
      arenaId: room.settings.arenaId,
      gameMode: room.settings.gameMode,
      fighterCount,
      p1ArchetypeId: sortedPlayers[0]?.archetypeId ?? 'ember',
      customHumans: sortedPlayers.map((p) => ({
        slot: p.slot,
        name: p.name,
        archetypeId: p.archetypeId,
        teamId: p.teamId,
      })),
    });

    this.renderer.resetMemories(this.sim.fighters);
    soundEngine.setMusicTheme(this.sim.arenaId, false);
    this.pushHudSnapshot();
  }

  public applyOnlineFrame(frame: ReplayFrame): void {
    if (!this.onlineMode) return;
    applyReplayFrameToSim(this.sim, frame);
    this.replayRecorder.pushExternalFrame(frame);
    this.processSimEvents(this.sim.events, this.screenState === 'playing');
    this.pushHudSnapshot();
  }

  public stopOnlineMatch(): void {
    this.onlineMode = false;
  }

  private applyAcademySetup(setup: MatchSetup, ac: ActiveScenarioSetup): void {
    this.sim = createSimulation({
      ...setup,
      arenaId: 'tutorial',
      fighterCount: ac.bots.length + 1,
      p2Enabled: false,
      demoMode: false,
      tutorial: true,
      tutorialMode: 'basics',
      tutorialPaceScale: ac.paceScale,
      tutorialBotBehavior: ac.botBehavior,
      tutorialBotAggression: ac.botAggression,
      tutorialBotHomeX: ac.botHomeX,
      playerStartDamage: ac.playerStartDamage,
      customArena: ac.arena,
      customBots: ac.bots,
    });
  }

  public startTutorial(
    setup: MatchSetup,
    mode: TutorialMode = 'basics',
    handedness: Handedness = this.handedness,
    startLevelIndex = 0,
    completedLevelIds: string[] = []
  ): void {
    this.lastSetup = { ...setup };
    this.handedness = handedness;
    this.screenState = 'playing';
    this.p2Enabled = false;
    this.onlineMode = false;
    this.finishSlowMoActive = false;
    this.spectatorFast = false;
    this.replayRecorder.reset();
    this.callbacks.onReplayUpdate?.(null);
    this.clearInputs();

    this.tutorialRunner = createTutorialRunner(
      mode,
      handedness,
      Date.now(),
      startLevelIndex,
      completedLevelIds
    );

    if (mode === 'crucible' && this.tutorialRunner.currentScenario) {
      const sc = this.tutorialRunner.currentScenario;
      this.sim = createSimulation({
        ...setup,
        arenaId: 'crucible',
        fighterCount: sc.bots.length + 1,
        p2Enabled: false,
        demoMode: false,
        tutorial: true,
        tutorialMode: 'crucible',
        tutorialPaceScale: sc.paceScale,
        customArena: sc.arena,
        customBots: sc.bots,
      });
    } else if (this.tutorialRunner.currentAcademySetup) {
      this.applyAcademySetup(setup, this.tutorialRunner.currentAcademySetup);
    } else {
      this.sim = createSimulation({
        ...setup,
        arenaId: 'tutorial',
        fighterCount: 2,
        p2Enabled: false,
        demoMode: false,
        tutorial: true,
        tutorialMode: 'basics',
      });
    }

    this.renderer.resetMemories(this.sim.fighters);
    soundEngine.setMusicTheme(this.sim.arenaId, false);
    this.pushHudSnapshot();
    this.callbacks.onTutorialUpdate?.(getTutorialSnapshot(this.tutorialRunner));
  }

  public jumpToTutorialLevel(levelIndex: number): void {
    if (!this.tutorialRunner || this.tutorialRunner.mode !== 'basics') return;
    const ac = jumpRunnerToLevel(this.tutorialRunner, levelIndex);
    if (!ac) return;
    this.screenState = 'playing';
    this.clearInputs();
    this.applyAcademySetup(this.lastSetup, ac);
    this.renderer.resetMemories(this.sim.fighters);
    this.pushHudSnapshot();
    this.callbacks.onTutorialUpdate?.(getTutorialSnapshot(this.tutorialRunner));
  }

  public hasReplayFrames(): boolean {
    return this.replayRecorder.hasFrames();
  }

  public startReplay(koOnly: boolean, koIndex?: number): boolean {
    const frames = this.replayRecorder.getFrames();
    if (frames.length === 0) return false;
    this.clearInputs();
    this.screenState = 'replay';
    this.replayPaused = false;
    this.replaySpeed = koOnly ? 0.5 : 1;
    this.replayTimer = 0;
    this.replayCursor = koOnly ? this.replayRecorder.findBestKoReplayStart(koIndex) : 0;

    this.renderer.resetMemories(this.sim.fighters);
    applyReplayFrameToSim(this.sim, frames[this.replayCursor]);
    this.renderer.updateVisuals(this.sim, 0.016);
    this.pushHudSnapshot();
    this.pushReplaySnapshot();
    return true;
  }

  public stopReplay(): void {
    this.replayPaused = true;
    this.callbacks.onReplayUpdate?.(null);
  }

  public toggleReplayPause(): void {
    if (this.screenState !== 'replay') return;
    const frames = this.replayRecorder.getFrames();
    if (this.replayPaused && this.replayCursor >= frames.length - 1) {
      this.replayCursor = 0;
    }
    this.replayPaused = !this.replayPaused;
    this.pushReplaySnapshot();
  }

  public setReplaySpeed(speed: 0.5 | 1 | 2): void {
    this.replaySpeed = speed;
    this.pushReplaySnapshot();
  }

  public seekReplay(frameIndex: number): void {
    const frames = this.replayRecorder.getFrames();
    if (frames.length === 0) return;
    const clamped = Math.max(0, Math.min(frames.length - 1, Math.round(frameIndex)));
    this.replayCursor = clamped;
    this.replayTimer = 0;
    applyReplayFrameToSim(this.sim, frames[clamped]);
    this.renderer.updateVisuals(this.sim, 0.016);
    this.pushHudSnapshot();
    this.pushReplaySnapshot();
  }

  public jumpToKo(delta: number): void {
    const frames = this.replayRecorder.getFrames();
    const kos = this.replayRecorder.getKoTimes();
    if (frames.length === 0 || kos.length === 0) return;
    const curTime = frames[this.replayCursor]?.elapsed ?? 0;

    if (delta < 0) {
      let targetIdx = 0;
      for (let i = kos.length - 1; i >= 0; i--) {
        if (kos[i] - 2.6 < curTime - 0.6) {
          targetIdx = i;
          break;
        }
      }
      this.seekReplay(this.replayRecorder.findBestKoReplayStart(targetIdx));
    } else {
      let targetIdx = kos.length - 1;
      for (let i = 0; i < kos.length; i++) {
        if (kos[i] > curTime + 0.5) {
          targetIdx = i;
          break;
        }
      }
      this.seekReplay(this.replayRecorder.findBestKoReplayStart(targetIdx));
    }
  }

  private pushReplaySnapshot(): void {
    const frames = this.replayRecorder.getFrames();
    if (frames.length === 0) {
      this.callbacks.onReplayUpdate?.(null);
      return;
    }
    const firstTime = frames[0].elapsed;
    const lastTime = frames[frames.length - 1].elapsed;
    const currentFrame = frames[this.replayCursor] ?? frames[0];
    this.callbacks.onReplayUpdate?.({
      frameIndex: this.replayCursor,
      totalFrames: frames.length,
      currentTime: currentFrame.elapsed - firstTime,
      totalDuration: Math.max(0.1, lastTime - firstTime),
      paused: this.replayPaused,
      speed: this.replaySpeed,
      koTimes: this.replayRecorder.getKoTimes(),
      startOffsetTime: firstTime,
    });
  }

  public toggleSpectatorSpeed(): boolean {
    this.spectatorFast = !this.spectatorFast;
    this.pushHudSnapshot();
    return this.spectatorFast;
  }

  public skipSpectating(): void {
    if (this.onlineMode || this.sim.isTutorial || this.screenState !== 'playing') return;
    // Fast-forward headless sim cleanly (up to 60s of match time) so standings resolve naturally
    let maxSteps = 3600;
    while (!this.sim.matchFinished && maxSteps > 0) {
      maxSteps--;
      const inputs: Record<number, PlayerInput> = {};
      for (const f of this.sim.fighters) {
        if (!f.alive) continue;
        inputs[f.id] = computeAiInput(this.sim, f, FIXED_DT);
      }
      stepSimulation(this.sim, FIXED_DT, inputs);
      this.replayRecorder.recordStep(this.sim);
    }

    if (!this.sim.matchFinished) {
      // Force resolution on current survival/stock/king standings
      this.sim.matchFinished = true;
    }

    this.finishSlowMoActive = false;
    this.spectatorFast = false;
    const arenaName = createArenaConfig(this.sim.arenaId).name;
    const result = buildMatchResult(this.sim, arenaName);
    this.screenState = 'gameover';
    this.pushHudSnapshot();
    this.callbacks.onMatchOver(result);
  }

  public setScreenState(state: GameScreenState): void {
    this.screenState = state;
    if (state !== 'playing') {
      this.clearInputs();
    }
    if (state !== 'replay') {
      this.callbacks.onReplayUpdate?.(null);
    }
    soundEngine.setMusicTheme(this.sim.arenaId, state === 'title');
  }

  public clearInputs(): void {
    this.keysDown.clear();
    this.keysJustPressed.clear();
    this.mouseJustLeft = false;
    this.mouseJustRight = false;
    this.mouseRightHeld = false;
    this.buffers = { jump: 0, dash: 0, slide: 0, grapple: 0, attack: 0, dive: 0 };
    this.pendingOnlineEdges = {
      jumpPressed: false,
      dashPressed: false,
      slidePressed: false,
      grapplePressed: false,
      divePressed: false,
      attackPressed: false,
    };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    soundEngine.unlockAndStartMusic();
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(e.code) &&
      this.screenState === 'playing'
    ) {
      e.preventDefault();
    }
    if (!e.repeat) {
      this.keysJustPressed.add(e.code);
      this.captureInputBuffers(e.code);
    }
    this.keysDown.add(e.code);
  };

  private captureInputBuffers(code: string): void {
    if (this.screenState !== 'playing') return;
    if (this.handedness === 'left') {
      if ((!this.p2Enabled && code === 'ArrowUp') || code === 'Space' || code === 'KeyI') {
        this.buffers.jump = BUFFER_WINDOW;
        this.pendingOnlineEdges.jumpPressed = true;
      }
      if ((!this.p2Enabled && code === 'ShiftRight') || code === 'KeyN') {
        this.buffers.dash = BUFFER_WINDOW;
        this.pendingOnlineEdges.dashPressed = true;
      }
      if ((!this.p2Enabled && code === 'ArrowDown') || code === 'KeyK') {
        this.buffers.slide = BUFFER_WINDOW;
        this.pendingOnlineEdges.slidePressed = true;
      }
      if (code === 'KeyO') {
        this.buffers.grapple = BUFFER_WINDOW;
        this.pendingOnlineEdges.grapplePressed = true;
      }
      if (code === 'KeyU') {
        this.buffers.attack = BUFFER_WINDOW;
        this.pendingOnlineEdges.attackPressed = true;
      }
      if ((!this.p2Enabled && code === 'Slash') || code === 'KeyB') {
        this.buffers.dive = BUFFER_WINDOW;
        this.pendingOnlineEdges.divePressed = true;
      }
    } else {
      if (code === 'KeyW' || code === 'Space' || (!this.p2Enabled && code === 'ArrowUp')) {
        this.buffers.jump = BUFFER_WINDOW;
        this.pendingOnlineEdges.jumpPressed = true;
      }
      if (code === 'ShiftLeft' || code === 'KeyK' || (!this.p2Enabled && code === 'ShiftRight')) {
        this.buffers.dash = BUFFER_WINDOW;
        this.pendingOnlineEdges.dashPressed = true;
      }
      if (code === 'KeyS' || (!this.p2Enabled && code === 'ArrowDown')) {
        this.buffers.slide = BUFFER_WINDOW;
        this.pendingOnlineEdges.slidePressed = true;
      }
      if (code === 'KeyE') {
        this.buffers.grapple = BUFFER_WINDOW;
        this.pendingOnlineEdges.grapplePressed = true;
      }
      if (code === 'KeyJ' || code === 'KeyF') {
        this.buffers.attack = BUFFER_WINDOW;
        this.pendingOnlineEdges.attackPressed = true;
      }
      if (code === 'KeyC') {
        this.buffers.dive = BUFFER_WINDOW;
        this.pendingOnlineEdges.divePressed = true;
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private onBlur = () => {
    this.clearInputs();
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.clearInputs();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    this.pointerClient.x = e.clientX;
    this.pointerClient.y = e.clientY;
    this.pointerClient.active = true;
  };

  private onPointerDown = (e: PointerEvent) => {
    soundEngine.unlockAndStartMusic();
    if (this.screenState !== 'playing') return;
    this.onPointerMove(e);
    if (e.button === 0) {
      this.mouseJustLeft = true;
      this.buffers.attack = BUFFER_WINDOW;
      this.pendingOnlineEdges.attackPressed = true;
    } else if (e.button === 2) {
      this.mouseRightHeld = true;
      this.mouseJustRight = true;
      this.buffers.grapple = BUFFER_WINDOW;
      this.pendingOnlineEdges.grapplePressed = true;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button === 2) this.mouseRightHeld = false;
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.screenState === 'playing') e.preventDefault();
  };

  private attachListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pointerup', this.onPointerUp);
    const dom = this.renderer.canvas;
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  private consumeBuffer(key: keyof ChaosEngine['buffers']): boolean {
    if (this.buffers[key] > 0) {
      this.buffers[key] = 0;
      return true;
    }
    return false;
  }

  private decayBuffers(dt: number): void {
    this.buffers.jump = Math.max(0, this.buffers.jump - dt);
    this.buffers.dash = Math.max(0, this.buffers.dash - dt);
    this.buffers.slide = Math.max(0, this.buffers.slide - dt);
    this.buffers.grapple = Math.max(0, this.buffers.grapple - dt);
    this.buffers.attack = Math.max(0, this.buffers.attack - dt);
    this.buffers.dive = Math.max(0, this.buffers.dive - dt);
  }

  private buildHumanInput(slot: number, fighterX: number, fighterY: number): PlayerInput {
    const k = this.keysDown;
    const jp = this.keysJustPressed;

    if (slot === 0) {
      let left = false;
      let right = false;
      let up = false;
      let down = false;
      let jumpHeld = false;
      let grappleHeld = false;
      let pullHeld = false;
      let defendHeld = false;

      if (this.handedness === 'left') {
        left = k.has('KeyJ') || (!this.p2Enabled && k.has('ArrowLeft'));
        right = k.has('KeyL') || (!this.p2Enabled && k.has('ArrowRight'));
        up = k.has('KeyI') || (!this.p2Enabled && k.has('ArrowUp'));
        down = k.has('KeyK') || (!this.p2Enabled && k.has('ArrowDown'));
        jumpHeld = up || k.has('Space');
        grappleHeld = k.has('KeyO') || this.mouseRightHeld;
        pullHeld = k.has('KeyV') || (!this.p2Enabled && (k.has('Period') || k.has('Semicolon')));
        defendHeld = k.has('KeyH') || (!this.p2Enabled && k.has('Quote'));
      } else {
        left = k.has('KeyA') || (!this.p2Enabled && k.has('ArrowLeft'));
        right = k.has('KeyD') || (!this.p2Enabled && k.has('ArrowRight'));
        up = k.has('KeyW') || (!this.p2Enabled && k.has('ArrowUp'));
        down = k.has('KeyS') || (!this.p2Enabled && k.has('ArrowDown'));
        jumpHeld = up || k.has('Space');
        grappleHeld = k.has('KeyE') || this.mouseRightHeld;
        pullHeld = k.has('KeyQ') || k.has('KeyV');
        defendHeld = k.has('KeyF') || k.has('KeyL');
      }

      const jumpPressed = this.consumeBuffer('jump');
      const dashPressed = this.consumeBuffer('dash');
      const slidePressed = this.consumeBuffer('slide');
      const grapplePressed = this.consumeBuffer('grapple') || this.mouseJustRight;
      const divePressed = this.consumeBuffer('dive') || (down && dashPressed);
      const attackPressed = (this.consumeBuffer('attack') || this.mouseJustLeft) && !down;

      let aimX: number | undefined;
      let aimY: number | undefined;
      if (this.pointerClient.active) {
        const worldAim = this.renderer.screenToWorld(this.pointerClient.x, this.pointerClient.y);
        const dx = worldAim.x - fighterX;
        const dy = worldAim.y - (fighterY + 0.85);
        const len = Math.hypot(dx, dy);
        if (len > 0.35) {
          aimX = dx / len;
          aimY = dy / len;
        }
      }

      return {
        moveX: (right ? 1 : 0) - (left ? 1 : 0),
        moveY: (up ? 1 : 0) - (down ? 1 : 0),
        jumpHeld,
        jumpPressed,
        dashPressed,
        slideHeld: down,
        slidePressed,
        grappleHeld,
        grapplePressed,
        pullHeld,
        divePressed,
        attackPressed,
        defendHeld,
        aimX,
        aimY,
      };
    }

    // Local Player 2 (Arrows + , . / ; RightShift ' M)
    const left = k.has('ArrowLeft');
    const right = k.has('ArrowRight');
    const up = k.has('ArrowUp');
    const down = k.has('ArrowDown');
    const dashPressed = jp.has('ShiftRight') || jp.has('Period');

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (up ? 1 : 0) - (down ? 1 : 0),
      jumpHeld: up,
      jumpPressed: jp.has('ArrowUp'),
      dashPressed,
      slideHeld: down,
      slidePressed: jp.has('ArrowDown'),
      grappleHeld: k.has('Slash'),
      grapplePressed: jp.has('Slash'),
      pullHeld: k.has('Quote'),
      divePressed: jp.has('KeyM') || (down && dashPressed),
      attackPressed: jp.has('Comma'),
      defendHeld: k.has('Semicolon'),
    };
  }

  private processSimEvents(events: SimEvent[], allowAudioAndBanners: boolean): void {
    for (const ev of events) {
      if (allowAudioAndBanners) {
        soundEngine.handleEvent(ev);
      }

      if (ev.type === 'jump' || ev.type === 'land') {
        this.renderer.spawnVfx('dust', ev.x, ev.y, '#e8dcc5', 5, 3.6, 0.22);
      } else if (ev.type === 'double_jump') {
        this.renderer.spawnVfx('dust', ev.x, ev.y, ev.color ?? '#f2be5c', 7, 5.2, 0.26);
        this.renderer.spawnVfx('ring', ev.x, ev.y, ev.color ?? '#f2be5c', 1, 0, 0.3, 1.8);
      } else if (ev.type === 'dash' || ev.type === 'slide') {
        this.renderer.spawnVfx('dust', ev.x, ev.y, '#e8dcc5', 6, 4.8, 0.24);
        this.renderer.spawnVfx('spark', ev.x, ev.y, ev.color ?? '#f2be5c', 6, 7.5, 0.22);
      } else if (ev.type === 'wall_jump') {
        this.renderer.spawnVfx('dust', ev.x, ev.y, '#e8dcc5', 6, 4.5, 0.24);
        this.renderer.spawnVfx('starburst', ev.x, ev.y, '#f4ead5', 1, 0, 0.36);
      } else if (ev.type === 'grapple_attach') {
        this.renderer.spawnVfx('spark', ev.x, ev.y, '#f2be5c', 8, 7.0, 0.2);
        this.renderer.spawnVfx('starburst', ev.x, ev.y, '#fff5df', 1, 0, 0.34);
      } else if (ev.type === 'attack_hit') {
        this.renderer.spawnVfx('starburst', ev.x, ev.y, '#fce5a2', 2, 1.5, 0.52);
        this.renderer.spawnVfx('spark', ev.x, ev.y, '#e88b4f', 12, 11.5, 0.26);
      } else if (ev.type === 'parry') {
        this.renderer.spawnVfx('ring', ev.x, ev.y, '#f2be5c', 1, 0, 0.4, 3.6);
        this.renderer.spawnVfx('starburst', ev.x, ev.y, '#fff6de', 2, 1, 0.65);
        this.renderer.spawnVfx('spark', ev.x, ev.y, '#f2be5c', 14, 12, 0.26);
      } else if (ev.type === 'mech_trigger' && ev.mechId) {
        const f = this.sim.fighters.find((ft) => ft.id === ev.fighterId);
        const mCol = resolveMechColors(
          ev.mechId,
          f?.isHuman ? this.equippedMechPalettes : undefined
        );
        this.renderer.spawnVfx('ring', ev.x, ev.y, mCol.color, 1, 0, 0.4, 3.2);
        this.renderer.spawnVfx('spark', ev.x, ev.y, mCol.sparkColor, 14, 10, 0.28);
        if (f && allowAudioAndBanners && (f.isHuman || this.sim.fighters.length <= 6)) {
          this.callbacks.onMechBanner(f.name, ev.mechId, mCol.color);
        }
      } else if (ev.type === 'mech_pulse') {
        const f = this.sim.fighters.find((ft) => ft.id === ev.fighterId);
        const mCol =
          ev.mechId && f?.isHuman
            ? resolveMechColors(ev.mechId, this.equippedMechPalettes)
            : null;
        const pulseColor = mCol?.color ?? ev.color ?? '#e3743b';
        const sparkColor = mCol?.sparkColor ?? ev.color ?? '#f2be5c';
        this.renderer.spawnVfx(
          'ring',
          ev.x,
          ev.y,
          pulseColor,
          1,
          0,
          0.4,
          (ev.power ?? 3.5) * 1.15
        );
        this.renderer.spawnVfx('starburst', ev.x, ev.y, pulseColor, 2, 2, 0.6);
        this.renderer.spawnVfx('spark', ev.x, ev.y, sparkColor, 18, 12.5, 0.28);
      } else if (ev.type === 'crate_break') {
        this.renderer.spawnVfx('spark', ev.x, ev.y, ev.color ?? '#c48a47', 14, 8.5, 0.28);
        this.renderer.spawnVfx('dust', ev.x, ev.y, '#d6c3a5', 7, 4.2, 0.34);
      } else if (ev.type === 'barrel_explode') {
        this.renderer.spawnVfx('ring', ev.x, ev.y, '#d94e34', 1, 0, 0.5, 5.4);
        this.renderer.spawnVfx('starburst', ev.x, ev.y, '#fce5a2', 2, 1.5, 0.85);
        this.renderer.spawnVfx('spark', ev.x, ev.y, '#e3743b', 22, 14, 0.32);
      } else if (ev.type === 'respawn') {
        this.renderer.spawnVfx('ring', ev.x, ev.y, ev.color ?? '#6eb5a4', 1, 0, 0.42, 2.8);
        this.renderer.spawnVfx('spark', ev.x, ev.y, '#fff5df', 10, 6.5, 0.24);
      } else if (ev.type === 'ko') {
        this.renderer.spawnVfx('ko_beam', ev.x, ev.y, ev.color ?? '#d95d57', 1, 0, 1.0, 2.6);
        this.renderer.spawnVfx('ring', ev.x, ev.y, ev.color ?? '#d95d57', 1, 0, 0.5, 6.2);
        this.renderer.spawnVfx('spark', ev.x, ev.y, '#fce5a2', 24, 15, 0.32);
      }
    }

    if (allowAudioAndBanners && this.screenState === 'playing' && events.length > 0) {
      const humanIds = this.sim.fighters
        .filter((f) => f.isHuman && (!this.onlineMode || f.playerSlot === this.localOnlineSlot))
        .map((f) => f.id);
      this.callbacks.onSimEvents?.(events, humanIds, Boolean(this.sim.isTutorial));
    }
  }

  private isP1EliminatedEarly(): boolean {
    if (this.onlineMode || this.sim.isTutorial || this.screenState !== 'playing') return false;
    if (this.sim.matchFinished) return false;
    const p1 = this.sim.fighters.find((f) => f.isHuman && f.playerSlot === 0);
    if (!p1) return false;
    if (p1.alive || p1.respawnTimer > 0) return false;
    const otherHumanAlive = this.sim.fighters.some(
      (f) => f.isHuman && f.playerSlot !== 0 && (f.alive || f.respawnTimer > 0)
    );
    if (otherHumanAlive) return false;
    const contenders = this.sim.fighters.filter((f) => f.alive || f.respawnTimer > 0);
    return contenders.length >= 2;
  }

  private pushHudSnapshot(): void {
    const summaries: HudFighterSummary[] = this.sim.fighters.map((f) => ({
      id: f.id,
      name: f.name,
      isHuman: f.isHuman,
      playerSlot: f.playerSlot,
      archetypeId: f.archetype.id,
      primaryColor: f.archetype.primaryColor,
      accentColor: f.archetype.accentColor,
      alive: f.alive,
      damagePercent: Math.round(f.damagePercent),
      kos: f.kos,
      deaths: f.deaths,
      stocks: f.stocks,
      maxStocks: f.maxStocks,
      teamId: f.teamId,
      kingScore: Math.round(f.kingScore),
      respawnTimer: f.respawnTimer,
      spawnInvuln: f.spawnInvulnTimer > 0,
      posture: Math.round(f.posture),
      activeMech: f.activeMech ? f.activeMech.id : null,
      activeMechColor: f.activeMech
        ? resolveMechColors(f.activeMech.id, f.isHuman ? this.equippedMechPalettes : undefined).color
        : null,
      grappling: f.grapple.active,
    }));

    const meta: HudMatchMeta = {
      gameMode: this.sim.gameMode,
      timeLimitSeconds: this.sim.timeLimitSeconds,
      teamScores: [this.sim.teamScores[0], this.sim.teamScores[1]],
      kingZone: this.sim.kingZone ? { ...this.sim.kingZone } : null,
      p1EliminatedEarly: this.isP1EliminatedEarly(),
      spectatorFast: this.spectatorFast,
      onlineMode: this.onlineMode,
    };

    this.callbacks.onHudUpdate(summaries, this.sim.elapsed, this.sim.escalationLevel, meta);
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const tutSnap =
      this.screenState === 'playing' && this.sim.isTutorial && this.tutorialRunner
        ? getTutorialSnapshot(this.tutorialRunner)
        : null;

    if (this.screenState === 'replay') {
      this.stepReplay(rawDt);
      this.renderer.updateCamera(this.sim, rawDt, false, null);
    } else if (this.screenState === 'title' || this.screenState === 'playing') {
      const timeScale =
        this.finishSlowMoActive
          ? 0.34
          : this.spectatorFast && this.isP1EliminatedEarly()
            ? 2.0
            : 1.0;

      this.accumulator += rawDt * timeScale;
      let steps = 0;

      while (this.accumulator >= FIXED_DT && steps < 6) {
        this.accumulator -= FIXED_DT;
        steps++;
        this.stepOneFrame(FIXED_DT);
      }

      if (this.finishSlowMoActive) {
        this.finishSlowMoTimer -= rawDt;
        if (this.finishSlowMoTimer <= 0) {
          this.finishSlowMoActive = false;
          const arenaName = createArenaConfig(this.sim.arenaId).name;
          const result = buildMatchResult(this.sim, arenaName);
          this.screenState = 'gameover';
          this.callbacks.onMatchOver(result);
        }
      }

      const focusPoint =
        tutSnap && !tutSnap.completed
          ? { x: tutSnap.waypointX, y: tutSnap.waypointY }
          : null;
      this.renderer.updateCamera(this.sim, rawDt, this.screenState === 'title', focusPoint);
    }

    const aimWorld =
      this.screenState === 'playing' && this.pointerClient.active
        ? { ...this.renderer.screenToWorld(this.pointerClient.x, this.pointerClient.y), active: true }
        : undefined;

    this.renderer.render(this.sim, {
      isPlaying: this.screenState === 'playing' || this.screenState === 'replay',
      waypoint:
        tutSnap && !tutSnap.completed
          ? {
              x: tutSnap.waypointX,
              y: tutSnap.waypointY,
              color: tutSnap.targetMech
                ? MECH_DEFINITIONS[tutSnap.targetMech].color
                : '#f2be5c',
            }
          : null,
      targetZone: tutSnap && !tutSnap.completed ? tutSnap.targetZone ?? null : null,
      aimWorld,
    });

    this.scheduleNextTick();
  };

  private stepReplay(rawDt: number): void {
    const frames = this.replayRecorder.getFrames();
    if (frames.length === 0) return;

    this.renderer.updateVisuals(this.sim, rawDt * this.replaySpeed);

    if (this.replayPaused) return;
    const frameStepDuration = (1 / 30) / this.replaySpeed;
    this.replayTimer += rawDt;
    let advanced = false;

    while (this.replayTimer >= frameStepDuration) {
      this.replayTimer -= frameStepDuration;
      if (this.replayCursor < frames.length - 1) {
        this.replayCursor += 1;
        const frame = frames[this.replayCursor];
        applyReplayFrameToSim(this.sim, frame);
        this.processSimEvents(frame.events, true);
        advanced = true;
      } else {
        this.replayPaused = true;
        break;
      }
    }

    if (advanced) {
      this.pushHudSnapshot();
      this.pushReplaySnapshot();
    } else if (this.replayPaused) {
      this.pushReplaySnapshot();
    }
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftware) {
      this.timerId = window.setTimeout(() => {
        if (!this.disposed) {
          this.frameId = requestAnimationFrame(this.tick);
        }
      }, 45);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private stepOneFrame(dt: number): void {
    if (this.onlineMode && this.screenState === 'playing') {
      const me = this.sim.fighters.find((f) => f.isHuman && f.playerSlot === this.localOnlineSlot);
      const input = this.buildHumanInput(0, me?.x ?? 0, me?.y ?? 2);
      // Merge buffered online edges cleanly so presses never drop at 30Hz
      const merged: PlayerInput = {
        ...input,
        jumpPressed: input.jumpPressed || this.pendingOnlineEdges.jumpPressed,
        dashPressed: input.dashPressed || this.pendingOnlineEdges.dashPressed,
        slidePressed: input.slidePressed || this.pendingOnlineEdges.slidePressed,
        grapplePressed: input.grapplePressed || this.pendingOnlineEdges.grapplePressed,
        divePressed: input.divePressed || this.pendingOnlineEdges.divePressed,
        attackPressed: input.attackPressed || this.pendingOnlineEdges.attackPressed,
      };
      this.keysJustPressed.clear();
      this.mouseJustLeft = false;
      this.mouseJustRight = false;
      this.decayBuffers(dt);

      this.onlineInputTimer += dt;
      const hasEdge =
        merged.jumpPressed ||
        merged.dashPressed ||
        merged.slidePressed ||
        merged.grapplePressed ||
        merged.divePressed ||
        merged.attackPressed;
      if (hasEdge || this.onlineInputTimer >= 1 / 30) {
        this.onlineInputTimer = 0;
        onlineClient.sendInput(merged);
        this.pendingOnlineEdges = {
          jumpPressed: false,
          dashPressed: false,
          slidePressed: false,
          grapplePressed: false,
          divePressed: false,
          attackPressed: false,
        };
      }
      this.renderer.updateVisuals(this.sim, dt);
      return;
    }

    const pace = this.sim.isTutorial ? (this.sim.tutorialPaceScale ?? 1.0) : 1.0;
    const simDt = dt * pace;
    const inputs: Record<number, PlayerInput> = {};

    for (const f of this.sim.fighters) {
      if (!f.alive) continue;
      if (f.isHuman && this.screenState === 'playing' && !this.finishSlowMoActive) {
        inputs[f.id] = this.buildHumanInput(f.playerSlot, f.x, f.y);
      } else {
        inputs[f.id] = computeAiInput(this.sim, f, simDt);
      }
    }

    this.keysJustPressed.clear();
    this.mouseJustLeft = false;
    this.mouseJustRight = false;
    this.decayBuffers(dt);

    stepSimulation(this.sim, simDt, inputs);
    this.processSimEvents(this.sim.events, this.screenState === 'playing');
    this.renderer.updateVisuals(this.sim, simDt);

    if (this.screenState === 'playing' && !this.sim.isTutorial) {
      this.replayRecorder.recordStep(this.sim);
    }

    // Continuous subtle Mech particle trails
    for (const f of this.sim.fighters) {
      if (!f.alive || !f.activeMech) continue;
      const mCol = resolveMechColors(f.activeMech.id, f.isHuman ? this.equippedMechPalettes : undefined);
      if (Math.random() < 0.5) {
        this.renderer.spawnVfx('spark', f.x, f.y + 0.7, mCol.sparkColor, 1, 2.4, 0.16);
      }
    }

    if (this.screenState === 'title' && this.sim.matchFinished) {
      this.sim = createSimulation({
        arenaId: this.sim.arenaId,
        gameMode: this.sim.gameMode,
        fighterCount: this.sim.fighters.length,
        p1ArchetypeId: this.sim.fighters[0].archetype.id,
        demoMode: true,
      });
      this.renderer.resetMemories(this.sim.fighters);
      return;
    }

    if (this.screenState === 'playing') {
      let tutorialDirty = false;
      if (this.sim.isTutorial && this.tutorialRunner) {
        const p1Input = inputs[0];
        const res = updateTutorialRunner(
          this.tutorialRunner,
          this.sim,
          this.sim.fighters[0],
          this.sim.events,
          simDt,
          Boolean(p1Input?.pullHeld)
        );

        if (res.nextCrucibleScenario) {
          const sc = res.nextCrucibleScenario;
          this.sim = createSimulation({
            ...this.lastSetup,
            arenaId: 'crucible',
            fighterCount: sc.bots.length + 1,
            p2Enabled: false,
            demoMode: false,
            tutorial: true,
            tutorialMode: 'crucible',
            tutorialPaceScale: sc.paceScale,
            customArena: sc.arena,
            customBots: sc.bots,
          });
          this.renderer.resetMemories(this.sim.fighters);
        } else if (res.nextAcademySetup) {
          this.applyAcademySetup(this.lastSetup, res.nextAcademySetup);
          this.renderer.resetMemories(this.sim.fighters);
        } else if (this.tutorialRunner.mode === 'crucible' && this.tutorialRunner.currentScenario) {
          this.sim.tutorialPaceScale = this.tutorialRunner.currentScenario.paceScale;
        }

        if (res.stepAdvanced || res.rerouted || res.justCompleted) {
          tutorialDirty = true;
          this.renderer.spawnVfx(
            'ring',
            res.snapshot.waypointX,
            res.snapshot.waypointY,
            res.rerouted ? '#d95d43' : '#f2be5c',
            1,
            0,
            0.4,
            3.6
          );
          this.renderer.spawnVfx('starburst', res.snapshot.waypointX, res.snapshot.waypointY, '#fff5df', 2, 2, 0.6);
          soundEngine.handleEvent({
            type: 'mech_trigger',
            x: res.snapshot.waypointX,
            y: res.snapshot.waypointY,
            mechId: res.justCompleted ? 'comet' : 'phantom',
          });
        }

        if (res.justCompleted) {
          this.screenState = 'gameover';
        }
        if (tutorialDirty || this.sim.events.length > 0 || this.hudThrottle >= 0.1) {
          this.callbacks.onTutorialUpdate?.(res.snapshot);
        }
      }

      this.hudThrottle += dt;
      if (this.hudThrottle >= 0.1 || this.sim.events.length > 0 || tutorialDirty) {
        this.hudThrottle = 0;
        this.pushHudSnapshot();
      }
      if (this.sim.matchFinished && !this.sim.isTutorial && !this.finishSlowMoActive) {
        // Dramatic slow-mo climax right at the winning KO/finish before popping results
        this.finishSlowMoActive = true;
        this.finishSlowMoTimer = 1.05;
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.timerId);
    this.resizeObserver.disconnect();

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pointerup', this.onPointerUp);

    const dom = this.renderer.canvas;
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('contextmenu', this.onContextMenu);

    this.renderer.dispose();
  }
}

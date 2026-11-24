import type { ArenaId, MechId, SimEvent } from './types';

export type MusicTheme = 'title' | 'meadow' | 'canopy' | 'islands' | 'factory' | 'furnace' | 'tutorial';

interface ThemeScore {
  bpm: number;
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  padWave: OscillatorType;
  bassNotes: number[]; // Hz, 0 = rest
  leadNotes: number[]; // Hz, 0 = rest
  padChord: number[];  // Hz warm pad played on bar start
  leadVol: number;
  bassVol: number;
}

const THEME_SCORES: Record<MusicTheme, ThemeScore> = {
  title: {
    bpm: 96,
    bassWave: 'triangle',
    leadWave: 'sine',
    padWave: 'sine',
    bassNotes: [146.83, 0, 174.61, 0, 130.81, 0, 146.83, 0, 110.0, 0, 130.81, 0, 146.83, 0, 164.81, 0],
    leadNotes: [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 0, 261.63, 329.63, 392.0, 440.0, 392.0, 349.23, 293.66, 0],
    padChord: [220.0, 261.63, 329.63],
    leadVol: 0.032,
    bassVol: 0.036,
  },
  meadow: {
    bpm: 118,
    bassWave: 'triangle',
    leadWave: 'triangle',
    padWave: 'sine',
    // Bright G-major / pastoral pentatonic bounce
    bassNotes: [196.0, 0, 246.94, 0, 146.83, 0, 196.0, 0, 164.81, 0, 196.0, 0, 146.83, 0, 220.0, 0],
    leadNotes: [392.0, 440.0, 493.88, 587.33, 659.25, 587.33, 493.88, 440.0, 392.0, 493.88, 587.33, 783.99, 659.25, 587.33, 493.88, 0],
    padChord: [196.0, 246.94, 293.66],
    leadVol: 0.036,
    bassVol: 0.034,
  },
  canopy: {
    bpm: 112,
    bassWave: 'triangle',
    leadWave: 'sine',
    padWave: 'triangle',
    // Breezy folk waltz feel in D Mixolydian
    bassNotes: [146.83, 220.0, 196.0, 146.83, 0, 220.0, 164.81, 246.94, 196.0, 146.83, 0, 196.0],
    leadNotes: [587.33, 659.25, 739.99, 659.25, 587.33, 493.88, 523.25, 587.33, 659.25, 587.33, 440.0, 0],
    padChord: [146.83, 220.0, 293.66],
    leadVol: 0.035,
    bassVol: 0.032,
  },
  islands: {
    bpm: 124,
    bassWave: 'triangle',
    leadWave: 'triangle',
    padWave: 'sine',
    // Dusk Ruins Dorian adventure motif
    bassNotes: [146.83, 146.83, 0, 174.61, 130.81, 0, 164.81, 0, 116.54, 0, 130.81, 0, 146.83, 174.61, 196.0, 0],
    leadNotes: [440.0, 523.25, 587.33, 0, 659.25, 587.33, 523.25, 440.0, 392.0, 440.0, 523.25, 440.0, 349.23, 392.0, 440.0, 0],
    padChord: [146.83, 220.0, 349.23],
    leadVol: 0.034,
    bassVol: 0.038,
  },
  factory: {
    bpm: 134,
    bassWave: 'sawtooth',
    leadWave: 'square',
    padWave: 'triangle',
    // Driving industrial pulse in E minor
    bassNotes: [82.41, 82.41, 0, 98.0, 82.41, 0, 110.0, 98.0, 82.41, 82.41, 0, 123.47, 110.0, 98.0, 73.42, 0],
    leadNotes: [329.63, 0, 392.0, 329.63, 493.88, 0, 440.0, 392.0, 329.63, 0, 440.0, 493.88, 587.33, 493.88, 392.0, 0],
    padChord: [164.81, 246.94],
    leadVol: 0.022,
    bassVol: 0.028,
  },
  furnace: {
    bpm: 138,
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    padWave: 'triangle',
    // Fiery Phrygian boss pulse
    bassNotes: [110.0, 110.0, 116.54, 110.0, 146.83, 0, 116.54, 110.0, 98.0, 98.0, 110.0, 0, 164.81, 146.83, 116.54, 0],
    leadNotes: [440.0, 466.16, 554.37, 466.16, 440.0, 392.0, 349.23, 0, 440.0, 523.25, 587.33, 554.37, 466.16, 440.0, 349.23, 0],
    padChord: [110.0, 164.81, 220.0],
    leadVol: 0.024,
    bassVol: 0.03,
  },
  tutorial: {
    bpm: 102,
    bassWave: 'sine',
    leadWave: 'triangle',
    padWave: 'sine',
    // Calm focused dojo marimba/woodwind pulse
    bassNotes: [130.81, 0, 196.0, 0, 146.83, 0, 196.0, 0, 164.81, 0, 196.0, 0, 146.83, 0, 130.81, 0],
    leadNotes: [392.0, 0, 440.0, 523.25, 0, 440.0, 392.0, 0, 329.63, 0, 392.0, 440.0, 523.25, 0, 392.0, 0],
    padChord: [196.0, 261.63, 329.63],
    leadVol: 0.028,
    bassVol: 0.03,
  },
};

const SFX_MUTE_KEY = 'chaos_sfx_muted';
const MUSIC_MUTE_KEY = 'chaos_music_muted';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private sfxMuted = false;
  private musicMuted = false;
  private currentTheme: MusicTheme = 'title';
  private stepIndex = 0;
  private musicTimerId: number | null = null;
  private musicActive = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.sfxMuted = window.localStorage.getItem(SFX_MUTE_KEY) === '1';
        this.musicMuted = window.localStorage.getItem(MUSIC_MUTE_KEY) === '1';
      } catch {
        // ignore storage errors
      }
    }
  }

  public isMuted(): boolean {
    return this.sfxMuted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public setMuted(m: boolean): void {
    this.sfxMuted = m;
    try {
      window.localStorage.setItem(SFX_MUTE_KEY, m ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.sfxMuted);
    return this.sfxMuted;
  }

  public setMusicMuted(m: boolean): void {
    this.musicMuted = m;
    try {
      window.localStorage.setItem(MUSIC_MUTE_KEY, m ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(m ? 0 : 0.72, this.ctx.currentTime, 0.05);
    }
    if (!m) {
      this.ensureMusicLoop();
    }
  }

  public toggleMusicMute(): boolean {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  public setMusicTheme(arenaId: ArenaId, isTitle: boolean): void {
    const next: MusicTheme = isTitle
      ? 'title'
      : arenaId === 'crucible' || arenaId === 'tutorial'
        ? 'tutorial'
        : arenaId;
    if (next !== this.currentTheme) {
      this.currentTheme = next;
      this.stepIndex = 0;
    }
    this.ensureMusicLoop();
  }

  public unlockAndStartMusic(): void {
    this.ensureContext(true);
    this.ensureMusicLoop();
  }

  private ensureContext(allowWhenSfxMuted = false): AudioContext | null {
    if (this.sfxMuted && !allowWhenSfxMuted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxMuted ? 0 : 1;
      this.sfxGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicMuted ? 0 : 0.72;
      this.musicGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureMusicLoop(): void {
    if (typeof window === 'undefined' || this.musicMuted) return;
    if (this.musicActive) return;
    this.musicActive = true;
    const tick = () => {
      if (!this.musicActive) return;
      const score = THEME_SCORES[this.currentTheme];
      const stepMs = (60 / score.bpm / 2) * 1000;
      if (!this.musicMuted && this.ctx && this.ctx.state === 'running') {
        this.playMusicStep(score);
      }
      this.musicTimerId = window.setTimeout(tick, stepMs);
    };
    this.musicTimerId = window.setTimeout(tick, 180);
  }

  private playMusicStep(score: ThemeScore): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const stepDur = 60 / score.bpm / 2;
    const bFreq = score.bassNotes[this.stepIndex % score.bassNotes.length];
    const lFreq = score.leadNotes[this.stepIndex % score.leadNotes.length];

    if (bFreq > 0) {
      this.musicVoice(ctx, out, bFreq, score.bassWave, score.bassVol, now, stepDur * 0.92, 950);
    }
    if (lFreq > 0) {
      this.musicVoice(ctx, out, lFreq, score.leadWave, score.leadVol, now, stepDur * 1.15, 2200);
    }
    if (this.stepIndex % 8 === 0) {
      for (const pFreq of score.padChord) {
        this.musicVoice(
          ctx,
          out,
          pFreq,
          score.padWave,
          0.012,
          now,
          stepDur * 7.2,
          900
        );
      }
    }

    this.stepIndex = (this.stepIndex + 1) % 48;
  }

  private musicVoice(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    wave: OscillatorType,
    peak: number,
    startTime: number,
    dur: number,
    lowpassHz: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpassHz, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + Math.min(0.04, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.03);
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const jitter = 0.94 + Math.random() * 0.12;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freqStart * jitter), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd * jitter), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noiseBurst(duration: number, gainPeak: number, highpassHz = 600): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpassHz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start();
  }

  public playMechCue(mechId: MechId): void {
    if (mechId === 'phantom') {
      this.tone(420, 880, 0.22, 'sine', 0.14);
      this.tone(630, 1260, 0.24, 'triangle', 0.1, 0.04);
    } else if (mechId === 'meteor') {
      this.tone(240, 85, 0.28, 'sawtooth', 0.14);
      this.noiseBurst(0.18, 0.12, 350);
    } else if (mechId === 'thunderbolt') {
      this.tone(720, 220, 0.16, 'square', 0.1);
      this.tone(1100, 380, 0.14, 'sawtooth', 0.08, 0.03);
    } else if (mechId === 'spider') {
      this.tone(540, 980, 0.15, 'triangle', 0.13);
      this.noiseBurst(0.08, 0.09, 1400);
    } else if (mechId === 'comet') {
      this.tone(360, 740, 0.22, 'sawtooth', 0.11);
      this.tone(520, 1040, 0.24, 'sine', 0.11, 0.04);
    } else if (mechId === 'bulldozer') {
      this.tone(135, 92, 0.26, 'sawtooth', 0.16);
      this.tone(180, 110, 0.24, 'square', 0.1, 0.02);
    }
  }

  public handleEvent(ev: SimEvent): void {
    switch (ev.type) {
      case 'jump':
        this.tone(240, 460, 0.11, 'sine', 0.08);
        break;
      case 'double_jump':
        this.tone(360, 680, 0.13, 'triangle', 0.09);
        break;
      case 'land':
        this.tone(130, 65, 0.08, 'sine', 0.07);
        break;
      case 'dash':
        this.noiseBurst(0.11, 0.09, 900);
        this.tone(320, 180, 0.1, 'triangle', 0.07);
        break;
      case 'slide':
        this.noiseBurst(0.14, 0.08, 1200);
        break;
      case 'wall_jump':
        this.tone(290, 560, 0.12, 'triangle', 0.09);
        break;
      case 'grapple_fire':
        this.noiseBurst(0.08, 0.08, 1600);
        this.tone(440, 740, 0.06, 'triangle', 0.06);
        break;
      case 'grapple_attach':
        this.tone(680, 920, 0.07, 'square', 0.08);
        break;
      case 'grapple_release':
        this.tone(420, 260, 0.07, 'sine', 0.05);
        break;
      case 'ledge_grab':
        this.tone(220, 310, 0.08, 'triangle', 0.07);
        break;
      case 'dive_start':
        this.tone(480, 160, 0.18, 'sawtooth', 0.08);
        break;
      case 'dive_impact':
        this.tone(140, 48, 0.22, 'triangle', 0.18);
        this.noiseBurst(0.18, 0.14, 240);
        break;
      case 'attack_swing':
        this.noiseBurst(0.09, 0.08, 1100);
        break;
      case 'attack_hit': {
        const power = ev.power ?? 15;
        const vol = Math.min(0.22, 0.1 + power * 0.004);
        this.tone(175, 55, 0.15, 'sawtooth', vol);
        this.noiseBurst(0.1, vol * 0.85, 450);
        break;
      }
      case 'parry':
        this.tone(880, 1320, 0.18, 'sine', 0.16);
        this.tone(1320, 1760, 0.16, 'triangle', 0.12, 0.03);
        break;
      case 'guard_block':
        this.tone(280, 190, 0.09, 'square', 0.08);
        break;
      case 'mech_trigger':
        if (ev.mechId) this.playMechCue(ev.mechId);
        break;
      case 'mech_pulse':
        this.tone(210, 72, 0.24, 'sawtooth', 0.15);
        this.noiseBurst(0.2, 0.13, 300);
        break;
      case 'crate_break':
        this.noiseBurst(0.16, 0.12, 420);
        this.tone(160, 75, 0.14, 'square', 0.09);
        break;
      case 'barrel_explode':
        this.tone(110, 36, 0.34, 'sawtooth', 0.22);
        this.noiseBurst(0.32, 0.2, 180);
        break;
      case 'respawn':
        this.tone(330, 660, 0.18, 'sine', 0.09);
        break;
      case 'ko':
        this.tone(180, 42, 0.42, 'sawtooth', 0.24);
        this.noiseBurst(0.35, 0.22, 220);
        this.tone(520, 260, 0.28, 'triangle', 0.12, 0.05);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();

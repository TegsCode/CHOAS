import React from 'react';
import { FastForward, Film, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import type { ReplaySnapshot } from '../game/engine';

interface ReplayControlsHudProps {
  snapshot: ReplaySnapshot;
  onTogglePause: () => void;
  onSetSpeed: (speed: 0.5 | 1 | 2) => void;
  onSeekFrame: (frameIndex: number) => void;
  onJumpKo: (delta: number) => void;
  onExit: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export const ReplayControlsHud: React.FC<ReplayControlsHudProps> = ({
  snapshot,
  onTogglePause,
  onSetSpeed,
  onSeekFrame,
  onJumpKo,
  onExit,
}) => {
  const hasKos = snapshot.koTimes.length > 0;
  const maxFrame = Math.max(1, snapshot.totalFrames - 1);

  return (
    <div
      className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 pointer-events-none"
      data-testid="replay-hud"
    >
      <div className="ink-panel pointer-events-auto rounded-xl px-4 py-3 w-full max-w-2xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#d95d43] text-[#fff8eb] border-2 border-[#120e17] text-[11px] font-extrabold uppercase tracking-wider">
              <Film className="w-3.5 h-3.5" />
              Fight Replay
            </span>
            <span className="font-mono-num text-xs font-bold text-[#f4ead5]">
              {formatClock(snapshot.currentTime)} / {formatClock(snapshot.totalDuration)}
            </span>
            {hasKos && (
              <span className="text-[11px] font-bold text-[#e8a848]">
                · {snapshot.koTimes.length} KO{snapshot.koTimes.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {([0.5, 1, 2] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSetSpeed(spd);
                }}
                className={`px-2 py-1 rounded border-2 border-[#120e17] font-mono-num text-xs font-extrabold cursor-pointer transition-colors ${
                  snapshot.speed === spd
                    ? 'bg-[#e8a848] text-[#141019]'
                    : 'bg-[#1c1724] text-[#d6c8b4] hover:bg-[#332c3f]'
                }`}
              >
                {spd}×
              </button>
            ))}

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onExit();
              }}
              aria-label="Exit Replay"
              className="ml-1 inline-flex items-center gap-1 px-3 py-1 rounded bg-[#f4ead5] hover:bg-[#ead9b7] text-[#141019] border-2 border-[#120e17] text-xs font-extrabold cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Results</span>
            </button>
          </div>
        </div>

        {/* Scrubber with Amber KO Climax Pins */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              disabled={!hasKos}
              onClick={(e) => {
                e.currentTarget.blur();
                onJumpKo(-1);
              }}
              aria-label="Previous KO moment"
              title="Jump to Previous KO"
              className="w-8 h-8 rounded-lg bg-[#332c3f] hover:bg-[#433a52] disabled:opacity-40 text-[#f4ead5] border-2 border-[#120e17] flex items-center justify-center cursor-pointer disabled:cursor-default"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              aria-label={snapshot.paused ? 'Play replay' : 'Pause replay'}
              className="w-9 h-8 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] flex items-center justify-center cursor-pointer"
            >
              {snapshot.paused ? (
                <Play className="w-4 h-4 fill-current" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              disabled={!hasKos}
              onClick={(e) => {
                e.currentTarget.blur();
                onJumpKo(1);
              }}
              aria-label="Next KO moment"
              title="Jump to Final KO"
              className="w-8 h-8 rounded-lg bg-[#332c3f] hover:bg-[#433a52] disabled:opacity-40 text-[#f4ead5] border-2 border-[#120e17] flex items-center justify-center cursor-pointer disabled:cursor-default"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={maxFrame}
              value={snapshot.frameIndex}
              onChange={(e) => onSeekFrame(Number(e.target.value))}
              aria-label="Replay timeline scrubber"
              className="w-full accent-[#e8a848] cursor-pointer relative z-10"
            />
            {snapshot.koTimes.map((koT, idx) => {
              const pct = Math.max(
                0,
                Math.min(
                  100,
                  ((koT - snapshot.startOffsetTime) / snapshot.totalDuration) * 100
                )
              );
              return (
                <span
                  key={`${koT}-${idx}`}
                  title={`KO at ${formatClock(koT - snapshot.startOffsetTime)}`}
                  className="absolute -top-2 w-2 h-2 rounded-full bg-[#e8a848] border border-[#120e17] -translate-x-1/2 pointer-events-none"
                  style={{ left: `${pct}%` }}
                />
              );
            })}
          </div>

          {hasKos && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSetSpeed(0.5);
                onJumpKo(1);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#6eb5a4] hover:bg-[#7ec4b3] text-[#141019] border-2 border-[#120e17] text-[11px] font-extrabold uppercase cursor-pointer whitespace-nowrap"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>KO Slow-Mo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

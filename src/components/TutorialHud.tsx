import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Compass,
  Flame,
  Gauge,
  Hand,
  Map as MapIcon,
  RotateCcw,
} from 'lucide-react';
import { MECH_DEFINITIONS } from '../game/constants';
import { Handedness, TutorialStepSnapshot } from '../game/types';

interface TutorialHudProps {
  snapshot: TutorialStepSnapshot;
  handedness: Handedness;
  onChangeHandedness: (h: Handedness) => void;
  onOpenLevelMap?: () => void;
  onJumpToLevel?: (levelIndex: number) => void;
  onSkipToArena: () => void;
}

export const TutorialHud: React.FC<TutorialHudProps> = ({
  snapshot,
  handedness,
  onChangeHandedness,
  onOpenLevelMap,
  onJumpToLevel,
  onSkipToArena,
}) => {
  const isCrucible = snapshot.mode === 'crucible';
  const mechColor = snapshot.targetMech
    ? MECH_DEFINITIONS[snapshot.targetMech].color
    : '#e8a848';

  const fails = snapshot.failuresOnLevel ?? 0;
  const maxFails = snapshot.maxFailsBeforeReroute ?? 2;

  return (
    <aside
      aria-label="Tutorial progress"
      className="fixed top-16 left-4 z-15 w-[372px] max-w-[calc(100vw-2rem)] pointer-events-none"
    >
      <div className="ink-panel rounded-xl p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider whitespace-nowrap shrink-0"
            style={{ color: isCrucible ? mechColor : '#e8a848' }}
          >
            {isCrucible ? (
              <Flame className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Compass className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="font-mono-num">
              {isCrucible
                ? `Crucible · Wave ${snapshot.stepIndex + 1}/${snapshot.totalSteps}`
                : `Academy · Lv ${snapshot.levelNumber}/${snapshot.totalLevels}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            {!isCrucible && onOpenLevelMap && (
              <button
                type="button"
                tabIndex={-1}
                data-open-academy-map="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenLevelMap();
                }}
                aria-label="Open 28-level curriculum map"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#332c3f] hover:bg-[#433a52] border-2 border-[#120e17] text-[#f4ead5] text-[10px] font-bold cursor-pointer whitespace-nowrap"
              >
                <MapIcon className="w-3 h-3 text-[#6eb5a4]" />
                <span>{snapshot.totalLevels} Levels</span>
              </button>
            )}

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onChangeHandedness(handedness === 'right' ? 'left' : 'right');
              }}
              aria-label={`Switch handedness (currently ${handedness})`}
              title="Switch Left/Right Handedness"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#332c3f] hover:bg-[#433a52] border-2 border-[#120e17] text-[#f4ead5] text-[10px] font-bold cursor-pointer whitespace-nowrap"
            >
              <Hand className="w-3 h-3 text-[#e8a848]" />
              <span>{handedness === 'right' ? 'R-Hand' : 'L-Hand'}</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              data-skip-tutorial="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onSkipToArena();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#d95d43] hover:bg-[#e36c52] border-2 border-[#120e17] text-[#fff8eb] text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Skip</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Pace + Tier + Reroute Failure Counter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {snapshot.paceLabel && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-num font-bold border border-[#120e17] ${
                snapshot.reteachMode
                  ? 'bg-[#6b4827] text-[#ffe5c0]'
                  : 'bg-[#1c1724] text-[#6eb5a4]'
              }`}
            >
              <Gauge className="w-3 h-3" />
              <span>{snapshot.paceLabel}</span>
            </span>
          )}

          {snapshot.tier && !isCrucible && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#1c1724] text-[#bcae9a] border border-[#120e17]">
              {snapshot.tier}
            </span>
          )}

          {fails > 0 && !isCrucible && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-bold bg-[#4e2629] text-[#ffd4cf] border border-[#120e17]">
              Falls: {fails}/{maxFails} (Reroute on {maxFails})
            </span>
          )}
        </div>

        {/* Adaptive Prerequisite Reroute Banner */}
        {snapshot.reroutedFrom && (
          <div
            className="mt-2 p-2.5 rounded-lg bg-[#422a22] border-2 border-[#d95d43] text-xs"
            role="status"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-extrabold text-[#ffb59e] uppercase tracking-wide text-[11px]">
                <RotateCcw className="w-3.5 h-3.5" />
                Rerouted for Reteach
              </span>
              {onJumpToLevel && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onJumpToLevel(snapshot.reroutedFrom!.levelIndex);
                  }}
                  className="pointer-events-auto px-2 py-0.5 rounded bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] text-[10px] font-bold border border-[#120e17] cursor-pointer whitespace-nowrap"
                >
                  Back to Lv {snapshot.reroutedFrom.levelNumber}
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#f4ead5] mt-1 leading-snug">
              {snapshot.reroutedFrom.reason} Clear this drill to resume{' '}
              <span className="font-bold">Lv {snapshot.reroutedFrom.levelNumber}</span>.
            </p>
          </div>
        )}

        <h2 className="font-display text-lg font-extrabold text-[#f4ead5] mt-2 leading-snug">
          {snapshot.title}
        </h2>
        <p className="text-xs text-[#d6c8b4] mt-1 leading-relaxed">
          {snapshot.instruction}
        </p>

        <ul className="mt-2.5 space-y-1.5">
          {snapshot.items.map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-md border-2 border-[#120e17] ${
                item.done
                  ? 'bg-[#365448] text-[#eef7ee]'
                  : 'bg-[#1c1724] text-[#f4ead5]'
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7de0a5] shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-[#e8a848] shrink-0" />
              )}
              <span className={item.done ? 'line-through opacity-80' : ''}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-2.5 font-hand text-sm text-[#e8c682] leading-snug">
          {snapshot.hint}
        </p>
      </div>
    </aside>
  );
};

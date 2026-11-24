import React from 'react';
import { CheckCircle2, Compass, Gauge, RotateCcw, X } from 'lucide-react';
import { getAcademyLevelSummaries } from '../game/academyLevels';
import { TutorialTier } from '../game/types';

interface AcademyMapModalProps {
  currentLevelIndex: number;
  completedLevelIds: string[];
  reroutedFrom?: {
    levelIndex: number;
    levelNumber: number;
    title: string;
    reason: string;
  } | null;
  onSelectLevel: (levelIndex: number) => void;
  onClose: () => void;
}

const TIER_STYLES: Record<TutorialTier, { label: string; bg: string; text: string }> = {
  beginner: { label: 'Beginner', bg: 'bg-[#365448]', text: 'text-[#eef7ee]' },
  foundation: { label: 'Foundation', bg: 'bg-[#3a4a5e]', text: 'text-[#e8f1fb]' },
  tactics: { label: 'Tactics', bg: 'bg-[#5c4332]', text: 'text-[#fae6cf]' },
  mastery: { label: 'Mastery', bg: 'bg-[#63323e]', text: 'text-[#ffe6eb]' },
};

export const AcademyMapModal: React.FC<AcademyMapModalProps> = ({
  currentLevelIndex,
  completedLevelIds,
  reroutedFrom,
  onSelectLevel,
  onClose,
}) => {
  const levels = getAcademyLevelSummaries();
  const completedSet = new Set(completedLevelIds);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#120e17]/80 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Mastery Academy 28-Level Curriculum"
    >
      <div className="ink-panel rounded-xl max-w-4xl w-full p-5 md:p-6 max-h-[86vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-[#120e17]">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#e8a848]">
              <Compass className="w-4 h-4" />
              <span>Chronological Curriculum · Beginner to Mastery</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-[#f4ead5] mt-0.5">
              Mastery Academy ({completedSet.size}/{levels.length} Cleared)
            </h2>
            <p className="text-xs text-[#d6c8b4] mt-0.5">
              Skills interleave in learning order — Movement I–V, Grapple I–III, Mechs, Tactics &amp; Strategy — pacing smoothly from 0.74× calm drills to 1.0× live combat.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close Academy Map"
            onClick={onClose}
            className="ink-paper p-2 rounded-lg hover:bg-[#ead9b7] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {levels.map((lv, idx) => {
            const isCurrent = idx === currentLevelIndex;
            const isDone = completedSet.has(lv.id);
            const isRerouteTarget = reroutedFrom?.levelIndex === idx;
            const tierStyle = TIER_STYLES[lv.tier];

            return (
              <button
                key={lv.id}
                type="button"
                data-academy-level={lv.number}
                onClick={() => onSelectLevel(idx)}
                className={`text-left p-3 rounded-lg border-2 border-[#120e17] transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isCurrent
                    ? 'bg-[#3b3042] ring-2 ring-[#e8a848] ink-shadow-sm'
                    : isRerouteTarget
                      ? 'bg-[#3d2d27] ring-2 ring-[#d95d43]'
                      : isDone
                        ? 'bg-[#26342f] hover:bg-[#2e403a]'
                        : 'bg-[#1c1724] hover:bg-[#2b2436]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-num text-xs font-extrabold text-[#e8a848]">
                    LV {String(lv.number).padStart(2, '0')}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tierStyle.bg} ${tierStyle.text}`}
                    >
                      {tierStyle.label}
                    </span>
                    {isDone && (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#7de0a5] shrink-0"
                        aria-label="Completed"
                      />
                    )}
                  </div>
                </div>

                <div className="font-display text-sm font-extrabold text-[#f4ead5] leading-snug">
                  {lv.shortTitle}
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-[#bcae9a] mt-auto pt-1">
                  <span className="inline-flex items-center gap-1 font-mono-num">
                    <Gauge className="w-3 h-3 text-[#6eb5a4]" />
                    {lv.paceLabel}
                  </span>

                  {isCurrent && (
                    <span className="text-[10px] font-extrabold uppercase text-[#e8a848]">
                      Active
                    </span>
                  )}
                  {!isCurrent && isRerouteTarget && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-[#f4937d]">
                      <RotateCcw className="w-2.5 h-2.5" />
                      Paused
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

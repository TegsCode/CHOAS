import React, { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Palette,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { MECH_DEFINITIONS, MECH_LIST } from '../game/constants';
import {
  DailyMissionStore,
  getPaletteById,
  getPalettesForMech,
  getResetCountdownLabel,
  resolveMechColors,
  UNLOCKABLE_MECH_PALETTES,
} from '../game/missions';
import { MechId } from '../game/types';

interface DailyMissionsModalProps {
  store: DailyMissionStore;
  initialTab?: 'missions' | 'palettes';
  onClaimMission: (missionId: string) => void;
  onEquipPalette: (mechId: MechId, paletteId: string) => void;
  onClose: () => void;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  store,
  initialTab = 'missions',
  onClaimMission,
  onEquipPalette,
  onClose,
}) => {
  const [tab, setTab] = useState<'missions' | 'palettes'>(initialTab);

  const unlockedSet = new Set(store.unlockedPaletteIds);
  const claimableCount = store.missions.filter((m) => m.completed && !m.claimed).length;
  const resetLabel = getResetCountdownLabel();

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#120e17]/80 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Missions and Mech Cosmetic Palettes"
    >
      <div className="ink-panel rounded-xl max-w-3xl w-full p-5 md:p-6 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-[#120e17]">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#e8a848]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Daily Missions · {store.dateKey}</span>
              <span className="text-[#f4ead5]/30" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-[#6eb5a4]">
                <Clock className="w-3.5 h-3.5" />
                Resets in {resetLabel}
              </span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-[#f4ead5] mt-0.5">
              Daily Bounties &amp; Mech Palettes
            </h2>
            <p className="text-xs text-[#d6c8b4] mt-0.5">
              Complete daily combat challenges to unlock hand-inked cosmetic color palettes for your 6 Mechs.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close Daily Missions"
            onClick={onClose}
            className="ink-paper p-2 rounded-lg hover:bg-[#ead9b7] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs & Unlock Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-missions-tab="missions"
              onClick={() => setTab('missions')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold border-2 border-[#120e17] cursor-pointer transition-colors ${
                tab === 'missions'
                  ? 'bg-[#e8a848] text-[#141019] ink-shadow-sm'
                  : 'bg-[#1c1724] text-[#d6c8b4] hover:bg-[#332c3f]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Today&apos;s Missions (3)</span>
              {claimableCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-[#d95d43] text-[#fff8eb] font-mono-num text-[10px]">
                  {claimableCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-missions-tab="palettes"
              onClick={() => setTab('palettes')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold border-2 border-[#120e17] cursor-pointer transition-colors ${
                tab === 'palettes'
                  ? 'bg-[#6eb5a4] text-[#141019] ink-shadow-sm'
                  : 'bg-[#1c1724] text-[#d6c8b4] hover:bg-[#332c3f]'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>
                Mech Wardrobe ({store.unlockedPaletteIds.length}/{UNLOCKABLE_MECH_PALETTES.length})
              </span>
            </button>
          </div>

          <div className="text-[11px] font-bold text-[#bcae9a] font-mono-num">
            Bounties Cleared: <span className="text-[#f4ead5]">{store.totalCompleted}</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="mt-4 overflow-y-auto pr-1 flex-1">
          {tab === 'missions' ? (
            <div className="flex flex-col gap-3">
              {store.missions.map((m) => {
                const reward = getPaletteById(m.rewardPaletteId);
                const rewardMech = reward ? MECH_DEFINITIONS[reward.mechId] : null;
                const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
                const isEquipped =
                  reward && store.equippedPalettes[reward.mechId] === reward.id;
                const alreadyOwned = reward ? unlockedSet.has(reward.id) : false;

                return (
                  <div
                    key={m.id}
                    data-mission-card={m.slot}
                    className={`p-4 rounded-xl border-2 border-[#120e17] transition-colors ${
                      m.claimed
                        ? 'bg-[#212b28]'
                        : m.completed
                          ? 'bg-[#362c24] ring-2 ring-[#e8a848]'
                          : 'bg-[#1c1724]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-num text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-[#2b2436] text-[#e8a848] border border-[#120e17]">
                            BOUNTY {m.slot + 1}
                          </span>
                          <h3 className="font-display text-base font-extrabold text-[#f4ead5]">
                            {m.title}
                          </h3>
                          {m.claimed && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#7de0a5]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Claimed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#d6c8b4] mt-1">{m.description}</p>

                        {/* Progress Bar */}
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <div className="flex-1 h-2.5 rounded bg-[#120e17] overflow-hidden border border-[#120e17]">
                            <div
                              className="h-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: m.completed ? '#7de0a5' : '#e8a848',
                              }}
                            />
                          </div>
                          <span className="font-mono-num text-xs font-extrabold text-[#f4ead5] shrink-0">
                            {m.progress}/{m.target}
                          </span>
                        </div>
                      </div>

                      {/* Reward & Action */}
                      {reward && rewardMech && (
                        <div className="sm:w-60 shrink-0 p-2.5 rounded-lg bg-[#141019]/75 border-2 border-[#120e17] flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#bcae9a]">
                                {rewardMech.name} Palette
                              </div>
                              <div className="text-xs font-extrabold text-[#f4ead5] truncate">
                                {reward.name}
                              </div>
                            </div>
                            {/* 3-Tone Swatch Dots */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              aria-label={`Colors: ${reward.name}`}
                            >
                              <span
                                className="w-4 h-4 rounded-full border-2 border-[#120e17]"
                                style={{ backgroundColor: reward.color }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border-2 border-[#120e17] -ml-2"
                                style={{ backgroundColor: reward.secondaryColor }}
                              />
                              <span
                                className="w-3 h-3 rounded-full border border-[#120e17] -ml-1.5"
                                style={{ backgroundColor: reward.sparkColor }}
                              />
                            </div>
                          </div>

                          {m.completed && !m.claimed ? (
                            <button
                              type="button"
                              data-claim-mission={m.id}
                              onClick={() => onClaimMission(m.id)}
                              className="w-full py-1.5 px-2.5 rounded-md bg-[#e8a848] hover:bg-[#f0b459] text-[#141019] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-xs uppercase tracking-wide inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{alreadyOwned ? 'Claim Bounty' : 'Claim & Equip'}</span>
                            </button>
                          ) : m.claimed ? (
                            <button
                              type="button"
                              onClick={() => onEquipPalette(reward.mechId, reward.id)}
                              className={`w-full py-1.5 px-2.5 rounded-md border-2 border-[#120e17] font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                                isEquipped
                                  ? 'bg-[#6eb5a4] text-[#141019]'
                                  : 'bg-[#2b2436] hover:bg-[#383047] text-[#f4ead5]'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isEquipped ? 'Equipped' : 'Equip Palette'}</span>
                            </button>
                          ) : (
                            <div className="text-[11px] font-semibold text-[#bcae9a] text-center py-1 rounded bg-[#1c1724]">
                              Complete bounty to unlock
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MECH_LIST.map((mech) => {
                const palettes = getPalettesForMech(mech.id);
                const activeResolved = resolveMechColors(mech.id, store.equippedPalettes);

                return (
                  <div
                    key={mech.id}
                    className="p-3.5 rounded-xl bg-[#1c1724] border-2 border-[#120e17] flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span
                          className="font-display text-base font-extrabold tracking-wide"
                          style={{ color: activeResolved.color }}
                        >
                          {mech.name}
                        </span>
                        <span className="ml-2 text-[11px] font-bold text-[#bcae9a]">
                          {activeResolved.paletteName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono-num font-bold text-[#d6c8b4]">
                        {mech.sequence.map((s) => s.replace('_', ' ')).join(' → ')}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {palettes.map((pal) => {
                        const unlocked = Boolean(pal.isDefault) || unlockedSet.has(pal.id);
                        const equipped = activeResolved.paletteId === pal.id;

                        return (
                          <button
                            key={pal.id}
                            type="button"
                            disabled={!unlocked}
                            data-equip-palette={pal.id}
                            onClick={() => onEquipPalette(mech.id, pal.id)}
                            aria-label={
                              unlocked
                                ? `Equip ${pal.name} palette for ${mech.name}`
                                : `${pal.name} palette for ${mech.name} is locked`
                            }
                            className={`w-full text-left px-2.5 py-2 rounded-lg border-2 border-[#120e17] flex items-center justify-between gap-2.5 transition-colors ${
                              equipped
                                ? 'bg-[#362f42] ring-2 ring-[#e8a848] cursor-pointer'
                                : unlocked
                                  ? 'bg-[#262030] hover:bg-[#322b3f] cursor-pointer'
                                  : 'bg-[#15111b] opacity-65 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex items-center shrink-0">
                                <span
                                  className="w-4 h-4 rounded-full border-2 border-[#120e17]"
                                  style={{ backgroundColor: pal.color }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full border-2 border-[#120e17] -ml-1.5"
                                  style={{ backgroundColor: pal.secondaryColor }}
                                />
                                <span
                                  className="w-3 h-3 rounded-full border border-[#120e17] -ml-1"
                                  style={{ backgroundColor: pal.sparkColor }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-[#f4ead5] truncate">
                                  {pal.name}
                                  {pal.isDefault && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-[#bcae9a]">
                                      (Default)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[#bcae9a] truncate">
                                  {pal.description}
                                </div>
                              </div>
                            </div>

                            {equipped ? (
                              <span className="px-2 py-0.5 rounded bg-[#e8a848] text-[#141019] text-[10px] font-extrabold shrink-0">
                                Active
                              </span>
                            ) : unlocked ? (
                              <span className="px-2 py-0.5 rounded bg-[#332c3f] text-[#f4ead5] text-[10px] font-bold shrink-0">
                                Equip
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#9e9285] shrink-0">
                                <Lock className="w-3 h-3" />
                                Daily
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

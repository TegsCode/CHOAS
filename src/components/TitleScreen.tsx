import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  Flame,
  Globe,
  Hand,
  Map as MapIcon,
  Music,
  Palette,
  Play,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  createArenaConfig,
  FIGHTER_ARCHETYPES,
  GAME_MODES,
  getControlBindings,
  MECH_LIST,
  PLAYABLE_ARENAS,
} from '../game/constants';
import { MatchSetup } from '../game/engine';
import { DailyMissionStore, resolveMechColors } from '../game/missions';
import { ArenaId, Handedness, TutorialMode } from '../game/types';
import { FighterCrest } from './FighterCrest';

interface TitleScreenProps {
  setup: MatchSetup;
  handedness: Handedness;
  tutorialCompleted: boolean;
  savedAcademyLevel?: number;
  academyTotal?: number;
  sfxMuted: boolean;
  musicMuted: boolean;
  missionStore: DailyMissionStore;
  onChangeSetup: (next: MatchSetup) => void;
  onChangeHandedness: (h: Handedness) => void;
  onToggleSfxMute: () => void;
  onToggleMusicMute: () => void;
  onStart: () => void;
  onStartTutorial: (mode: TutorialMode) => void;
  onOpenAcademyMap: () => void;
  onOpenOnlineLobby: () => void;
  onOpenDailyMissions: (tab?: 'missions' | 'palettes') => void;
}

const ARENA_SHORT_LABELS: Partial<Record<ArenaId, string>> = {
  meadow: 'Overworld',
  canopy: 'Toadstool',
  islands: 'Dusk Ruins',
  factory: 'Foundry',
  furnace: 'Caldera',
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  setup,
  handedness,
  tutorialCompleted,
  savedAcademyLevel = 0,
  academyTotal = 28,
  sfxMuted,
  musicMuted,
  missionStore,
  onChangeSetup,
  onChangeHandedness,
  onToggleSfxMute,
  onToggleMusicMute,
  onStart,
  onStartTutorial,
  onOpenAcademyMap,
  onOpenOnlineLobby,
  onOpenDailyMissions,
}) => {
  const [showCodex, setShowCodex] = useState(false);
  const [selectingSlot, setSelectingSlot] = useState<1 | 2>(1);

  const activeArchetype =
    FIGHTER_ARCHETYPES.find((a) => a.id === setup.p1ArchetypeId) ?? FIGHTER_ARCHETYPES[0];
  const p2Archetype =
    FIGHTER_ARCHETYPES.find((a) => a.id === setup.p2ArchetypeId) ?? FIGHTER_ARCHETYPES[1];
  const activeArena = createArenaConfig(setup.arenaId);
  const activeMode = GAME_MODES.find((m) => m.id === setup.gameMode) ?? GAME_MODES[0];
  const bindings = getControlBindings(handedness, setup.p2Enabled);
  const completedMissionsCount = missionStore.missions.filter((m) => m.completed).length;
  const claimableMissionsCount = missionStore.missions.filter(
    (m) => m.completed && !m.claimed
  ).length;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 md:p-6 pointer-events-none">
      {/* Upper Header Region: Hand-Inked Title Lockup + Audio, Handedness & Codex Controls */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto max-w-md">
          <svg
            viewBox="0 0 360 92"
            className="w-56 md:w-72 h-auto -rotate-1"
            aria-label="CHAOS"
          >
            <polygon points="18,18 344,10 328,82 10,86" fill="#120e17" />
            <polygon
              points="12,12 338,4 322,76 4,80"
              fill="#f4ead5"
              stroke="#120e17"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <polygon
              points="18,17 42,16 30,71 10,72"
              fill="#d95d43"
              stroke="#120e17"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <text
              x="186"
              y="60"
              textAnchor="middle"
              fill="#141019"
              fontFamily="'Bricolage Grotesque', sans-serif"
              fontWeight="800"
              fontSize="50"
              letterSpacing="5"
            >
              CHAOS
            </text>
          </svg>
          <p className="mt-1.5 font-hand text-base md:text-lg text-[#f4ead5] drop-shadow-[2px_2px_0px_#120e17]">
            Hand-Drawn Physics Arena Brawler · Hook Grappling &amp; Combo Mechs
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={onToggleMusicMute}
            aria-label={musicMuted ? 'Turn background music on' : 'Mute background music'}
            className={`ink-panel inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              musicMuted ? 'text-[#9e9285]' : 'text-[#e8a848] hover:bg-[#332c3f]'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>{musicMuted ? 'Music Off' : 'Music On'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSfxMute}
            aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            className="ink-panel inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#f4ead5] hover:bg-[#332c3f] transition-colors cursor-pointer whitespace-nowrap"
          >
            {sfxMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{sfxMuted ? 'SFX Off' : 'SFX On'}</span>
          </button>

          <button
            type="button"
            data-handedness-toggle="true"
            onClick={() => onChangeHandedness(handedness === 'right' ? 'left' : 'right')}
            aria-label={`Control layout: ${handedness === 'right' ? 'Right-Handed' : 'Left-Handed'}. Click to switch.`}
            className="ink-panel inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-[#f4ead5] hover:bg-[#332c3f] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Hand className="w-4 h-4 text-[#e8a848]" />
            <span>{handedness === 'right' ? 'Right-Handed' : 'Left-Handed'}</span>
          </button>

          <button
            type="button"
            data-daily-missions-btn="true"
            onClick={() => onOpenDailyMissions('missions')}
            aria-label={`Daily Missions: ${completedMissionsCount} of ${missionStore.missions.length} completed`}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold border-2 border-[#120e17] ink-shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              claimableMissionsCount > 0
                ? 'bg-[#e8a848] hover:bg-[#f0b459] text-[#141019]'
                : 'ink-panel text-[#f4ead5] hover:bg-[#332c3f]'
            }`}
          >
            <Calendar
              className={`w-4 h-4 ${
                claimableMissionsCount > 0 ? 'text-[#141019]' : 'text-[#e8a848]'
              }`}
            />
            <span>
              Daily ({completedMissionsCount}/{missionStore.missions.length})
            </span>
            {claimableMissionsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#d95d43] text-[#fff8eb] font-mono-num text-[10px] leading-none border border-[#120e17]">
                +{claimableMissionsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowCodex((v) => !v)}
            className="ink-paper inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-extrabold hover:bg-[#ead9b7] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span>Mech Codex ({MECH_LIST.length})</span>
          </button>
        </div>
      </div>

      {/* Main Setup Deck */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-4 mt-auto mb-1.5">
        {/* Left: Fighter Roster Picker */}
        <div className="pointer-events-auto ink-panel rounded-xl p-4 w-full lg:w-[448px]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectingSlot(1)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold border-2 border-[#120e17] cursor-pointer whitespace-nowrap transition-colors ${
                  selectingSlot === 1
                    ? 'bg-[#e8a848] text-[#141019]'
                    : 'bg-[#332c3f] text-[#dfd2be] hover:bg-[#3f374d]'
                }`}
              >
                P1 · {activeArchetype.name}
              </button>
              {setup.p2Enabled && (
                <button
                  type="button"
                  onClick={() => setSelectingSlot(2)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold border-2 border-[#120e17] cursor-pointer whitespace-nowrap transition-colors ${
                    selectingSlot === 2
                      ? 'bg-[#6eb5a4] text-[#141019]'
                      : 'bg-[#332c3f] text-[#dfd2be] hover:bg-[#3f374d]'
                  }`}
                >
                  P2 · {p2Archetype.name}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const nextP2 = !setup.p2Enabled;
                if (!nextP2) setSelectingSlot(1);
                onChangeSetup({ ...setup, p2Enabled: nextP2 });
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold border-2 border-[#120e17] cursor-pointer whitespace-nowrap transition-colors ${
                setup.p2Enabled
                  ? 'bg-[#6eb5a4] text-[#141019]'
                  : 'bg-[#332c3f] text-[#dfd2be] hover:bg-[#3f374d]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{setup.p2Enabled ? '2P Local On' : '+ 2P Local'}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {FIGHTER_ARCHETYPES.map((arch) => {
              const isP1 = setup.p1ArchetypeId === arch.id;
              const isP2 = setup.p2Enabled && setup.p2ArchetypeId === arch.id;
              return (
                <button
                  key={arch.id}
                  type="button"
                  onClick={() => {
                    if (selectingSlot === 1) {
                      onChangeSetup({ ...setup, p1ArchetypeId: arch.id });
                    } else {
                      onChangeSetup({ ...setup, p2ArchetypeId: arch.id });
                    }
                  }}
                  aria-label={`Select fighter ${arch.name}`}
                  className={`relative flex flex-col items-center p-1.5 rounded-lg border-2 transition-transform cursor-pointer ${
                    isP1
                      ? 'bg-[#3f323b] border-[#e8a848] -translate-y-0.5 ink-shadow-sm'
                      : isP2
                        ? 'bg-[#2a383c] border-[#6eb5a4] -translate-y-0.5 ink-shadow-sm'
                        : 'bg-[#1c1724] border-[#120e17] hover:bg-[#2e2738]'
                  }`}
                >
                  <FighterCrest archetype={arch} size={44} />
                  <span className="mt-1 text-[11px] font-bold text-[#f4ead5] truncate w-full text-center">
                    {arch.name}
                  </span>
                  {(isP1 || isP2) && (
                    <span
                      className={`absolute top-0 left-0 px-1.5 py-0.5 rounded-tl-md rounded-br-md border-r-2 border-b-2 border-[#120e17] text-[10px] font-extrabold leading-none ${
                        isP1 ? 'bg-[#e8a848] text-[#141019]' : 'bg-[#6eb5a4] text-[#141019]'
                      }`}
                    >
                      {isP1 && isP2 ? 'P1/2' : isP1 ? 'P1' : 'P2'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs text-[#d6c8b4]">
            {selectingSlot === 1 ? activeArchetype.tagline : p2Archetype.tagline}
          </p>
        </div>

        {/* Right: Mode, 5 Arenas, Online Play, Direct Academy Access & Enter Arena */}
        <div className="pointer-events-auto ink-panel rounded-xl p-4 w-full lg:w-[492px] flex flex-col gap-2.5">
          {/* Game Mode Row */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-[#d6c8b4] mb-1">
              <span>Mode</span>
              <span className="text-[#6eb5a4]">{activeMode.subtitle}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {GAME_MODES.map((m) => {
                const active = setup.gameMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-game-mode={m.id}
                    onClick={() => onChangeSetup({ ...setup, gameMode: m.id })}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-extrabold border-2 border-[#120e17] transition-colors cursor-pointer truncate ${
                      active
                        ? 'bg-[#e8a848] text-[#141019] ink-shadow-sm'
                        : 'bg-[#1c1724] text-[#d6c8b4] hover:bg-[#332c3f]'
                    }`}
                  >
                    {m.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5 Arenas Row */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-[#d6c8b4] mb-1">
              <span>Stage</span>
              <span className="text-[#e8a848] truncate max-w-[300px]">{activeArena.subtitle}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {PLAYABLE_ARENAS.map((id) => {
                const active = setup.arenaId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-arena={id}
                    onClick={() => onChangeSetup({ ...setup, arenaId: id })}
                    className={`px-1.5 py-2 rounded-lg text-[11px] font-extrabold border-2 border-[#120e17] transition-colors cursor-pointer truncate ${
                      active
                        ? 'bg-[#d95d43] text-[#fff8eb] ink-shadow-sm'
                        : 'bg-[#1c1724] text-[#d6c8b4] hover:bg-[#332c3f]'
                    }`}
                  >
                    {ARENA_SHORT_LABELS[id] ?? createArenaConfig(id).name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fighter Count */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#d6c8b4] whitespace-nowrap">
              Fighters ({activeMode.shortName})
            </span>
            <div className="flex items-center gap-1.5">
              {[4, 6, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onChangeSetup({ ...setup, fighterCount: count })}
                  className={`px-3 py-1 rounded-md text-xs font-bold font-mono-num border-2 border-[#120e17] cursor-pointer transition-colors ${
                    setup.fighterCount === count
                      ? 'bg-[#e8a848] text-[#141019]'
                      : 'bg-[#1c1724] text-[#d6c8b4] hover:bg-[#332c3f]'
                  }`}
                >
                  {count}P
                </button>
              ))}
            </div>
          </div>

          {/* Primary Play + Online Play */}
          <div className="grid grid-cols-[1.45fr_1fr] gap-2">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="py-3 px-4 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] active:translate-y-0.5 text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-base tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Enter Arena</span>
            </button>

            <button
              type="button"
              data-online-open="true"
              onClick={onOpenOnlineLobby}
              className="py-3 px-3 rounded-lg bg-[#3b6e8c] hover:bg-[#4881a3] active:translate-y-0.5 text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-sm tracking-wide uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-4 h-4" />
              <span>Online Play</span>
            </button>
          </div>

          {/* Academy + Direct 28-Level Map + Crucible */}
          <div className="grid grid-cols-[1.2fr_auto_1fr] gap-2">
            <button
              type="button"
              data-tutorial="basics"
              onClick={() => onStartTutorial('basics')}
              className="py-2 px-2.5 rounded-lg bg-[#f4ead5] hover:bg-[#ead9b7] text-[#141019] border-2 border-[#120e17] ink-shadow-sm font-display font-bold text-xs tracking-wide uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-4 h-4 shrink-0" />
              <span>
                {tutorialCompleted
                  ? `1. Academy`
                  : savedAcademyLevel > 0
                    ? `1. Lv ${savedAcademyLevel + 1}/${academyTotal}`
                    : `1. Academy`}
              </span>
            </button>

            <button
              type="button"
              data-academy-map-btn="true"
              onClick={onOpenAcademyMap}
              title="Browse all 28 Mastery Academy levels"
              className="py-2 px-3 rounded-lg bg-[#e8a848] hover:bg-[#f0b459] text-[#141019] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-xs uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>{academyTotal} Levels</span>
            </button>

            <button
              type="button"
              data-tutorial="crucible"
              onClick={() => onStartTutorial('crucible')}
              className="py-2 px-2.5 rounded-lg bg-[#6eb5a4] hover:bg-[#7ec4b3] text-[#141019] border-2 border-[#120e17] ink-shadow-sm font-display font-bold text-xs tracking-wide uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Flame className="w-4 h-4 shrink-0" />
              <span>2. Crucible</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Safe Margin Control Hint reflecting active Handedness & 2P */}
      <div className="text-center text-[11px] md:text-xs text-[#f4ead5] font-semibold tracking-wide drop-shadow-[2px_2px_0px_#120e17]">
        {bindings.compactLine}
      </div>

      {/* Mech Codex Modal Drawer */}
      {showCodex && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#120e17]/80 pointer-events-auto">
          <div className="ink-panel rounded-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-[#f4ead5]">
                  Mech Combinations
                </h2>
                <p className="text-xs text-[#d6c8b4] mt-0.5">
                  All 6 Mechs trigger automatically when you chain their movement verbs in combat.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodex(false);
                    onOpenDailyMissions('palettes');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6eb5a4] hover:bg-[#7ec4b3] text-[#141019] border-2 border-[#120e17] text-xs font-extrabold cursor-pointer whitespace-nowrap"
                >
                  <Palette className="w-4 h-4" />
                  <span>Customize Palettes</span>
                </button>
                <button
                  type="button"
                  aria-label="Close Mech Codex"
                  onClick={() => setShowCodex(false)}
                  className="ink-paper p-2 rounded-lg hover:bg-[#ead9b7] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MECH_LIST.map((m) => {
                const activePal = resolveMechColors(m.id, missionStore.equippedPalettes);
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-lg bg-[#1c1724] border-2 border-[#120e17]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full border border-[#120e17] shrink-0"
                          style={{ backgroundColor: activePal.color }}
                        />
                        <span
                          className="font-display text-base font-extrabold tracking-wide truncate"
                          style={{ color: activePal.color }}
                        >
                          {m.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[#bcae9a] shrink-0">
                        {activePal.paletteName}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs font-mono-num font-bold text-[#f4ead5]">
                      {m.sequence.map((s) => s.replace('_', ' ').toUpperCase()).join(' → ')}
                    </div>
                    <p className="mt-1.5 text-xs text-[#d6c8b4] leading-relaxed">
                      {m.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

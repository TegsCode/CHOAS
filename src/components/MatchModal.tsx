import React from 'react';
import {
  Award,
  FastForward,
  Film,
  Flame,
  Hand,
  Home,
  Music,
  Palette,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GAME_MODES, getControlBindings, MECH_DEFINITIONS, MECH_LIST } from '../game/constants';
import { DailyMission, getPaletteById } from '../game/missions';
import {
  GameScreenState,
  Handedness,
  MatchResultSummary,
  TutorialMode,
} from '../game/types';

interface MatchModalProps {
  screenState: GameScreenState;
  result: MatchResultSummary | null;
  tutorialComplete: boolean;
  tutorialMode: TutorialMode;
  handedness: Handedness;
  p2Enabled?: boolean;
  sfxMuted: boolean;
  musicMuted: boolean;
  hasReplay: boolean;
  isOnlineMatch: boolean;
  isOnlineHost: boolean;
  claimableMissions?: DailyMission[];
  onClaimMission?: (missionId: string) => void;
  onOpenDailyMissions?: () => void;
  onChangeHandedness: (h: Handedness) => void;
  onToggleSfxMute: () => void;
  onToggleMusicMute: () => void;
  onResume: () => void;
  onRestart: () => void;
  onStartReplay: (koOnly: boolean) => void;
  onAdvanceToCrucible: () => void;
  onEnterArenaFromTutorial: () => void;
  onOnlineRematch: () => void;
  onBackToTitle: () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export const MatchModal: React.FC<MatchModalProps> = ({
  screenState,
  result,
  tutorialComplete,
  tutorialMode,
  handedness,
  p2Enabled = false,
  sfxMuted,
  musicMuted,
  hasReplay,
  isOnlineMatch,
  isOnlineHost,
  claimableMissions = [],
  onClaimMission,
  onOpenDailyMissions,
  onChangeHandedness,
  onToggleSfxMute,
  onToggleMusicMute,
  onResume,
  onRestart,
  onStartReplay,
  onAdvanceToCrucible,
  onEnterArenaFromTutorial,
  onOnlineRematch,
  onBackToTitle,
}) => {
  const bindings = getControlBindings(handedness, p2Enabled);

  const renderClaimableMissions = () => {
    if (claimableMissions.length === 0 || !onClaimMission) return null;
    return (
      <div className="mt-4 p-3 rounded-xl bg-[#302620] border-2 border-[#e8a848] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#e8a848]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Daily Bounty Complete!</span>
          </div>
          {onOpenDailyMissions && (
            <button
              type="button"
              onClick={onOpenDailyMissions}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6eb5a4] hover:text-[#91d8c7] cursor-pointer"
            >
              <Palette className="w-3 h-3" />
              <span>Wardrobe</span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {claimableMissions.map((m) => {
            const reward = getPaletteById(m.rewardPaletteId);
            const mechDef = reward ? MECH_DEFINITIONS[reward.mechId] : null;
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#1c1724] border border-[#120e17]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {reward && (
                    <div className="flex items-center shrink-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-[#120e17]"
                        style={{ backgroundColor: reward.color }}
                      />
                      <span
                        className="w-3 h-3 rounded-full border border-[#120e17] -ml-1"
                        style={{ backgroundColor: reward.secondaryColor }}
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-[#f4ead5] truncate">
                      {m.title}
                    </div>
                    {reward && mechDef && (
                      <div className="text-[10px] text-[#d6c8b4] truncate">
                        {mechDef.name}: {reward.name}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  data-claim-mission={m.id}
                  onClick={() => onClaimMission(m.id)}
                  className="px-2.5 py-1.5 rounded-md bg-[#e8a848] hover:bg-[#f0b459] text-[#141019] border-2 border-[#120e17] font-display font-extrabold text-[11px] uppercase tracking-wide shrink-0 cursor-pointer"
                >
                  Claim &amp; Equip
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (screenState === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#120e17]/75">
        <div className="ink-panel rounded-xl max-w-lg w-full p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#f4ead5]">
                Match Paused
              </h2>
              <p className="text-xs text-[#d6c8b4] mt-0.5">
                Chain movement verbs to trigger Mechs automatically.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleMusicMute}
                aria-label={musicMuted ? 'Turn music on' : 'Mute music'}
                className="ink-paper inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer"
              >
                <Music className="w-3.5 h-3.5" />
                <span>{musicMuted ? 'Off' : 'On'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleSfxMute}
                aria-label={sfxMuted ? 'Unmute SFX' : 'Mute SFX'}
                className="ink-paper inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer"
              >
                {sfxMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>SFX</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeHandedness(handedness === 'right' ? 'left' : 'right')}
                className="ink-paper inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer whitespace-nowrap"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>{handedness === 'right' ? 'Right' : 'Left'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {MECH_LIST.map((m) => (
              <div
                key={m.id}
                className="px-3 py-2 rounded-lg bg-[#1c1724] border-2 border-[#120e17]"
              >
                <div className="text-xs font-display font-extrabold" style={{ color: m.color }}>
                  {m.name}
                </div>
                <div className="text-[11px] font-mono-num text-[#f4ead5] mt-0.5">
                  {m.sequence.map((v) => v.replace('_', ' ')).join(' → ')}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-[#e8c682] font-semibold">
            {bindings.compactLine}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={onResume}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </button>
            {!isOnlineMatch && (
              <button
                type="button"
                onClick={onRestart}
                className="py-2.5 px-4 rounded-lg bg-[#332c3f] hover:bg-[#433a52] text-[#f4ead5] border-2 border-[#120e17] font-semibold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart</span>
              </button>
            )}
            <button
              type="button"
              onClick={onBackToTitle}
              className="py-2.5 px-4 rounded-lg bg-[#332c3f] hover:bg-[#433a52] text-[#f4ead5] border-2 border-[#120e17] font-semibold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>{isOnlineMatch ? 'Leave Room' : 'Title'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screenState === 'gameover' && tutorialComplete) {
    const isCrucible = tutorialMode === 'crucible';
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#120e17]/80">
        <div className="ink-panel rounded-xl max-w-md w-full p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#f4ead5] border-2 border-[#120e17] ink-shadow-sm">
              {isCrucible ? (
                <Flame className="w-6 h-6 text-[#d95d43]" />
              ) : (
                <Award className="w-6 h-6 text-[#527a57]" />
              )}
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#f4ead5]">
                {isCrucible ? 'Crucible Mastered!' : 'Academy Mastered!'}
              </h2>
              <p className="text-xs text-[#d6c8b4]">
                {isCrucible
                  ? 'You adapted to every procedural combat arena and wielded Mechs under live fire.'
                  : 'All 28 Mastery Academy levels cleared! Take on Stage 2 in the Mech Crucible or enter live combat.'}
              </p>
            </div>
          </div>

          {renderClaimableMissions()}

          <div className="flex flex-col gap-2.5 mt-5">
            {!isCrucible ? (
              <button
                type="button"
                data-advance-crucible="true"
                onClick={onAdvanceToCrucible}
                className="w-full py-3 px-4 rounded-lg bg-[#6eb5a4] hover:bg-[#7ec4b3] text-[#141019] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-base uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>Advance to Mech Crucible</span>
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onEnterArenaFromTutorial}
                className="w-full py-3 px-4 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-base uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Enter Live Arena</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              {!isCrucible && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onEnterArenaFromTutorial}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] font-bold text-xs uppercase tracking-wide inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Enter Arena</span>
                </button>
              )}
              <button
                type="button"
                onClick={onRestart}
                className="flex-1 py-2.5 px-3 rounded-lg bg-[#332c3f] hover:bg-[#433a52] text-[#f4ead5] border-2 border-[#120e17] font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isCrucible ? 'New Crucible' : 'Replay'}</span>
              </button>
              <button
                type="button"
                onClick={onBackToTitle}
                className="flex-1 py-2.5 px-3 rounded-lg bg-[#332c3f] hover:bg-[#433a52] text-[#f4ead5] border-2 border-[#120e17] font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Setup</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screenState === 'gameover' && result) {
    const modeLabel =
      GAME_MODES.find((m) => m.id === result.gameMode)?.name ?? 'Last Player Standing';
    const headline = result.humanWon
      ? result.gameMode === 'team_chaos'
        ? `Victory — ${result.winnerName}!`
        : result.gameMode === 'king_of_platform'
          ? 'Victory — Crowned King!'
          : 'Victory — Champion!'
      : `${result.winnerName} Wins`;

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#120e17]/80">
        <div className="ink-panel rounded-xl max-w-lg w-full p-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center border-2 border-[#120e17] ink-shadow-sm"
              style={{ backgroundColor: result.winnerColor }}
            >
              <Trophy className="w-6 h-6 text-[#fff8eb]" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#f4ead5]">{headline}</h2>
              <p className="text-xs text-[#d6c8b4]">
                {modeLabel} · {result.arenaName} · Finished #{result.humanPlacement} of{' '}
                {result.totalFighters}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-4">
            <div className="p-3 rounded-lg bg-[#1c1724] border-2 border-[#120e17]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#bcae9a]">
                Time
              </div>
              <div className="font-mono-num text-xl font-bold text-[#f4ead5] mt-0.5">
                {formatTime(result.durationSeconds)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#1c1724] border-2 border-[#120e17]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#bcae9a]">
                Your KOs
              </div>
              <div className="font-mono-num text-xl font-bold text-[#e8a848] mt-0.5">
                {result.humanKos}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#1c1724] border-2 border-[#120e17]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#bcae9a]">
                Mechs
              </div>
              <div className="font-mono-num text-xl font-bold text-[#6eb5a4] mt-0.5">
                {result.humanMechs}
              </div>
            </div>
          </div>

          <div className="mt-4 max-h-44 overflow-y-auto divide-y divide-[#120e17] rounded-lg bg-[#1c1724] border-2 border-[#120e17]">
            {result.standings.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono-num font-bold text-[#bcae9a] w-5">
                    #{s.placement}
                  </span>
                  <span
                    className="w-3 h-3 rounded-xs border border-[#120e17] shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-bold text-[#f4ead5]">{s.name}</span>
                  {result.gameMode === 'team_chaos' && s.teamId !== null && (
                    <span
                      className={`text-[9px] font-extrabold px-1 rounded ${
                        s.teamId === 0
                          ? 'bg-[#d95d43] text-[#fff8eb]'
                          : 'bg-[#54a897] text-[#141019]'
                      }`}
                    >
                      {s.teamId === 0 ? 'RED' : 'TEAL'}
                    </span>
                  )}
                </div>
                <div className="font-mono-num text-[#d6c8b4]">
                  {result.gameMode === 'king_of_platform'
                    ? `${s.kingScore}% Crown · ${s.kos} KO`
                    : result.gameMode === 'stock_brawl' || result.gameMode === 'team_chaos'
                      ? `${s.stocksLeft} Stk · ${s.kos} KO`
                      : `${s.kos} KO · ${s.mechsTriggered} Mech`}
                </div>
              </div>
            ))}
          </div>

          {renderClaimableMissions()}

          {/* Replay Action Bar */}
          {hasReplay && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                data-ko-replay="true"
                onClick={() => onStartReplay(true)}
                className="py-2 px-3 rounded-lg bg-[#e8a848] hover:bg-[#f0b459] text-[#141019] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-xs uppercase tracking-wide inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>KO Slow-Mo Replay</span>
              </button>
              <button
                type="button"
                data-full-replay="true"
                onClick={() => onStartReplay(false)}
                className="py-2 px-3 rounded-lg bg-[#6eb5a4] hover:bg-[#7ec4b3] text-[#141019] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-xs uppercase tracking-wide inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Full Fight Replay</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-3">
            {isOnlineMatch ? (
              isOnlineHost ? (
                <button
                  type="button"
                  onClick={onOnlineRematch}
                  className="flex-1 py-3 px-4 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-base uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Return to Room (Rematch)</span>
                </button>
              ) : (
                <div className="flex-1 py-2.5 px-3 rounded-lg bg-[#282233] border-2 border-[#120e17] text-xs font-bold text-[#d6c8b4] text-center">
                  Waiting for Host to start rematch...
                </div>
              )
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="flex-1 py-3 px-4 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-base uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
            )}

            <button
              type="button"
              onClick={onBackToTitle}
              className="py-3 px-4 rounded-lg bg-[#332c3f] hover:bg-[#433a52] text-[#f4ead5] border-2 border-[#120e17] font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>{isOnlineMatch ? 'Leave' : 'Setup'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

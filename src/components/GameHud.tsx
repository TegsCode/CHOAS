import React from 'react';
import {
  Crown,
  FastForward,
  Globe,
  Music,
  Pause,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { FIGHTER_ARCHETYPES, MECH_DEFINITIONS } from '../game/constants';
import type { HudMatchMeta } from '../game/engine';
import { HudFighterSummary, MechId } from '../game/types';
import { FighterCrest } from './FighterCrest';

interface GameHudProps {
  fighters: HudFighterSummary[];
  elapsed: number;
  escalation: number;
  meta: HudMatchMeta;
  sfxMuted: boolean;
  musicMuted: boolean;
  mechBanner: { id: number; fighterName: string; mechId: MechId; color: string } | null;
  onToggleSfxMute: () => void;
  onToggleMusicMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onToggleSpectatorSpeed: () => void;
  onSkipSpectating: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  fighters,
  elapsed,
  escalation,
  meta,
  sfxMuted,
  musicMuted,
  mechBanner,
  onToggleSfxMute,
  onToggleMusicMute,
  onPause,
  onRestart,
  onToggleSpectatorSpeed,
  onSkipSpectating,
}) => {
  const aliveCount = fighters.filter((f) => f.alive || f.respawnTimer > 0).length;
  const clockSec =
    meta.timeLimitSeconds !== null ? Math.max(0, meta.timeLimitSeconds - elapsed) : elapsed;
  const leaderKing =
    meta.gameMode === 'king_of_platform'
      ? fighters.reduce<HudFighterSummary | null>(
          (best, cur) => (!best || cur.kingScore > best.kingScore ? cur : best),
          null
        )
      : null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4">
      {/* Top Bar: Match Status Center + Compact Utility Controls Right */}
      <div className="flex items-start justify-between gap-4">
        <div className="w-32 flex items-center">
          {meta.onlineMode && (
            <span className="ink-panel inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider text-[#6eb5a4]">
              <Globe className="w-3.5 h-3.5" />
              Online
            </span>
          )}
        </div>

        <div className="ink-panel flex items-center gap-3.5 px-4 py-1.5 rounded-lg flex-wrap justify-center">
          {meta.gameMode === 'team_chaos' ? (
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase">
              <span className="text-[#e36352] font-mono-num text-sm">
                RED {meta.teamScores[0]}
              </span>
              <span className="text-[#bcae9a]">vs</span>
              <span className="text-[#6eb5a4] font-mono-num text-sm">
                TEAL {meta.teamScores[1]}
              </span>
            </div>
          ) : meta.gameMode === 'king_of_platform' ? (
            <div className="flex items-center gap-2 text-xs font-extrabold">
              <Crown className="w-4 h-4 text-[#e8a848]" />
              <span className="text-[#f4ead5] uppercase tracking-wide">
                {meta.kingZone?.contested
                  ? 'Zone Contested'
                  : leaderKing
                    ? `${leaderKing.name} ${leaderKing.kingScore}%`
                    : 'Hold Crown Zone'}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono-num text-lg font-bold text-[#f4ead5]">
                {aliveCount}/{fighters.length}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#bcae9a]">
                {meta.gameMode === 'stock_brawl' ? 'In Brawl' : 'Alive'}
              </span>
            </div>
          )}

          <span className="text-[#f4ead5]/25" aria-hidden="true">
            |
          </span>
          <span
            className={`font-mono-num text-base font-bold ${
              meta.timeLimitSeconds !== null && clockSec <= 15
                ? 'text-[#e36352]'
                : 'text-[#e8a848]'
            }`}
          >
            {formatClock(clockSec)}
          </span>
          {escalation > 0 && (
            <>
              <span className="text-[#f4ead5]/25" aria-hidden="true">
                |
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#e36352]">
                Surging Lv.{escalation}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            aria-label={musicMuted ? 'Unmute background music' : 'Mute background music'}
            title={musicMuted ? 'Music Off' : 'Music On'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMusicMute();
            }}
            className={`ink-panel w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${
              musicMuted ? 'text-[#8c8174]' : 'text-[#e8a848] hover:bg-[#332c3f]'
            }`}
          >
            <Music className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            title="SFX Mute [M]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleSfxMute();
            }}
            className="ink-panel w-9 h-9 rounded-lg flex items-center justify-center text-[#f4ead5] hover:bg-[#332c3f] cursor-pointer"
          >
            {sfxMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {!meta.onlineMode && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart match"
              title="Restart [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="ink-panel w-9 h-9 rounded-lg flex items-center justify-center text-[#f4ead5] hover:bg-[#332c3f] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause match"
            title="Pause [P / Esc]"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="ink-panel w-9 h-9 rounded-lg flex items-center justify-center text-[#f4ead5] hover:bg-[#d95d43] cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Comic Mech Activation Banner */}
      <div className="flex justify-center mt-2 mb-auto">
        {mechBanner && (
          <div
            key={mechBanner.id}
            className="animate-mech-pop ink-paper px-5 py-1.5 rounded-lg flex items-center gap-2.5"
            style={{ borderColor: '#120e17' }}
          >
            <span
              className="w-3 h-3 rounded-xs border-2 border-[#120e17]"
              style={{ backgroundColor: mechBanner.color }}
            />
            <span className="font-display text-lg font-extrabold tracking-wide uppercase text-[#18131d]">
              {MECH_DEFINITIONS[mechBanner.mechId].name}!
            </span>
            <span className="font-hand text-base text-[#463b4d]">
              — {mechBanner.fighterName}
            </span>
          </div>
        )}
      </div>

      {/* Early-Elimination Spectator Controls */}
      {meta.p1EliminatedEarly && (
        <div className="flex justify-center mb-2 pointer-events-auto">
          <div className="ink-panel px-4 py-2 rounded-xl flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#d6c8b4]">
              Eliminated · Spectating
            </span>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleSpectatorSpeed();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border-2 border-[#120e17] text-xs font-extrabold cursor-pointer ${
                meta.spectatorFast
                  ? 'bg-[#e8a848] text-[#141019]'
                  : 'bg-[#332c3f] text-[#f4ead5] hover:bg-[#433a52]'
              }`}
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{meta.spectatorFast ? '2× Speed On' : 'Watch 2×'}</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSkipSpectating();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] text-xs font-extrabold cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Skip to Results</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Fighter Portrait Cards */}
      <div className="flex flex-wrap items-end justify-center gap-2.5">
        {fighters.map((f, idx) => {
          const arch =
            FIGHTER_ARCHETYPES.find((a) => a.id === f.archetypeId) ?? FIGHTER_ARCHETYPES[0];
          const dmgColor =
            f.damagePercent >= 120
              ? 'text-[#e36352]'
              : f.damagePercent >= 60
                ? 'text-[#e8a848]'
                : 'text-[#f4ead5]';
          const tilt = idx % 2 === 0 ? '-rotate-1' : 'rotate-1';
          const teamBorder =
            meta.gameMode === 'team_chaos' && f.teamId !== null
              ? f.teamId === 0
                ? '#d95d43'
                : '#54a897'
              : f.primaryColor;

          return (
            <div
              key={f.id}
              className={`ink-panel ${tilt} flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-opacity ${
                f.alive || f.respawnTimer > 0 ? 'opacity-100' : 'opacity-45'
              }`}
              style={{
                borderBottomColor: f.alive || f.respawnTimer > 0 ? teamBorder : '#120e17',
                borderBottomWidth: f.alive || f.respawnTimer > 0 ? '4px' : undefined,
              }}
            >
              <FighterCrest archetype={arch} size={36} />
              <div className="min-w-[74px]">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-bold text-[#e6dac6] truncate max-w-[78px]">
                    {meta.onlineMode
                      ? f.name
                      : f.isHuman
                        ? f.playerSlot === 0
                          ? 'P1'
                          : 'P2'
                        : arch.name}
                  </span>
                  {meta.gameMode === 'team_chaos' && f.teamId !== null ? (
                    <span
                      className={`text-[9px] font-extrabold px-1 rounded ${
                        f.teamId === 0
                          ? 'bg-[#d95d43] text-[#fff8eb]'
                          : 'bg-[#54a897] text-[#141019]'
                      }`}
                    >
                      {f.teamId === 0 ? 'RED' : 'TEAL'}
                    </span>
                  ) : f.kos > 0 ? (
                    <span className="text-[10px] font-mono-num font-bold text-[#e8a848]">
                      {f.kos} KO
                    </span>
                  ) : null}
                </div>

                <div className={`font-mono-num text-xl font-bold leading-none mt-0.5 ${dmgColor}`}>
                  {f.alive
                    ? `${f.damagePercent}%`
                    : f.respawnTimer > 0
                      ? `${f.respawnTimer.toFixed(1)}s`
                      : 'OUT'}
                </div>

                {/* Stock pips for Stock Brawl / Team Chaos */}
                {f.maxStocks > 1 && f.maxStocks <= 5 && (
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: f.maxStocks }).map((_, sIdx) => (
                      <span
                        key={sIdx}
                        className={`w-2 h-2 rounded-full border border-[#120e17] ${
                          sIdx < f.stocks ? 'bg-[#e8a848]' : 'bg-[#120e17]/60'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* King Crown Score bar */}
                {meta.gameMode === 'king_of_platform' && (
                  <div className="w-full h-1.5 bg-[#120e17] rounded-xs mt-1 overflow-hidden">
                    <div
                      className="h-full bg-[#e8a848]"
                      style={{ width: `${Math.min(100, f.kingScore)}%` }}
                    />
                  </div>
                )}

                {f.isHuman && f.alive && meta.gameMode !== 'king_of_platform' && (
                  <div className="w-full h-1.5 bg-[#120e17] rounded-xs mt-1 overflow-hidden">
                    <div
                      className="h-full bg-[#6eb5a4]"
                      style={{ width: `${f.posture}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

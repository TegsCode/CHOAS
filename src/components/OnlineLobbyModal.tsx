import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Globe,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import {
  createArenaConfig,
  FIGHTER_ARCHETYPES,
  GAME_MODES,
  PLAYABLE_ARENAS,
} from '../game/constants';
import type { PublicRoomSummary, RoomStatePayload } from '../game/netTypes';
import { onlineClient } from '../game/onlineClient';
import type { ArenaId, FighterArchetypeId, GameMode } from '../game/types';
import { FighterCrest } from './FighterCrest';

interface OnlineLobbyModalProps {
  open: boolean;
  room: RoomStatePayload | null;
  myClientId: string | null;
  initialArenaId: ArenaId;
  initialGameMode: GameMode;
  initialArchetypeId: FighterArchetypeId;
  initialJoinCode?: string;
  errorMessage: string | null;
  onClearError: () => void;
  onClose: () => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  open,
  room,
  myClientId,
  initialArenaId,
  initialGameMode,
  initialArchetypeId,
  initialJoinCode = '',
  errorMessage,
  onClearError,
  onClose,
}) => {
  const [playerName, setPlayerName] = useState('Wanderer');
  const [archetypeId, setArchetypeId] = useState<FighterArchetypeId>(initialArchetypeId);
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [createArenaId, setCreateArenaId] = useState<ArenaId>(
    PLAYABLE_ARENAS.includes(initialArenaId) ? initialArenaId : 'meadow'
  );
  const [createMode, setCreateMode] = useState<GameMode>(initialGameMode);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [fillWithBots, setFillWithBots] = useState(true);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const refreshRooms = useCallback(async () => {
    setLoadingRooms(true);
    const list = await onlineClient.fetchRooms();
    setPublicRooms(list);
    setLoadingRooms(false);
  }, []);

  useEffect(() => {
    if (open && !room) {
      onlineClient.connect();
      refreshRooms();
    }
  }, [open, room, refreshRooms]);

  useEffect(() => {
    if (initialJoinCode) {
      setJoinCode(initialJoinCode);
    }
  }, [initialJoinCode]);

  if (!open) return null;

  const myMember = room?.players.find((p) => p.clientId === myClientId) ?? null;
  const isHost = Boolean(myMember?.isHost);

  const handleCopyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}/?room=${room.code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#120e17]/80 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Online Multiplayer Lobby"
    >
      <div className="ink-panel rounded-xl max-w-3xl w-full p-5 md:p-6 max-h-[90vh] flex flex-col overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-[#120e17]">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#6eb5a4]">
              <Globe className="w-4 h-4" />
              <span>Authoritative WebSocket Arena · Live Multiplayer</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-[#f4ead5] mt-0.5">
              {room ? `Room ${room.code}` : 'Online Brawl'}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close Online Lobby"
            onClick={() => {
              if (room) onlineClient.leaveRoom();
              onClose();
            }}
            className="ink-paper p-2 rounded-lg hover:bg-[#ead9b7] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3 px-3.5 py-2 rounded-lg bg-[#63262b] border-2 border-[#120e17] text-xs font-bold text-[#ffe6e3] flex items-center justify-between gap-2">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={onClearError}
              className="text-[11px] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {!room ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Left Column: Fighter Identity & Create Room */}
            <div className="p-4 rounded-xl bg-[#1c1724] border-2 border-[#120e17] flex flex-col gap-3">
              <div>
                <label
                  htmlFor="online-player-name"
                  className="block text-xs font-bold text-[#d6c8b4] mb-1"
                >
                  Your Fighter Name
                </label>
                <input
                  id="online-player-name"
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#282233] border-2 border-[#120e17] text-sm font-bold text-[#f4ead5] focus:outline-none focus:border-[#e8a848]"
                  placeholder="Wanderer"
                />
              </div>

              <div>
                <div className="text-xs font-bold text-[#d6c8b4] mb-1.5">Pick Character</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {FIGHTER_ARCHETYPES.map((arch) => {
                    const active = archetypeId === arch.id;
                    return (
                      <button
                        key={arch.id}
                        type="button"
                        onClick={() => setArchetypeId(arch.id)}
                        className={`p-1.5 rounded-lg border-2 flex flex-col items-center cursor-pointer ${
                          active
                            ? 'bg-[#3f323b] border-[#e8a848]'
                            : 'bg-[#262030] border-[#120e17] hover:bg-[#322b3e]'
                        }`}
                      >
                        <FighterCrest archetype={arch} size={32} />
                        <span className="mt-0.5 text-[10px] font-bold text-[#f4ead5] truncate w-full text-center">
                          {arch.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t-2 border-[#120e17] pt-3 flex flex-col gap-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#e8a848]">
                  Host New Room
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="online-create-mode"
                      className="block text-[11px] font-bold text-[#bcae9a] mb-1"
                    >
                      Mode
                    </label>
                    <select
                      id="online-create-mode"
                      value={createMode}
                      onChange={(e) => setCreateMode(e.target.value as GameMode)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#282233] border-2 border-[#120e17] text-xs font-bold text-[#f4ead5]"
                    >
                      {GAME_MODES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.shortName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="online-create-arena"
                      className="block text-[11px] font-bold text-[#bcae9a] mb-1"
                    >
                      Stage
                    </label>
                    <select
                      id="online-create-arena"
                      value={createArenaId}
                      onChange={(e) => setCreateArenaId(e.target.value as ArenaId)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#282233] border-2 border-[#120e17] text-xs font-bold text-[#f4ead5]"
                    >
                      {PLAYABLE_ARENAS.map((id) => (
                        <option key={id} value={id}>
                          {createArenaConfig(id).name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {[2, 4, 6, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxPlayers(n)}
                        className={`px-2.5 py-1 rounded border-2 border-[#120e17] font-mono-num text-xs font-bold cursor-pointer ${
                          maxPlayers === n
                            ? 'bg-[#e8a848] text-[#141019]'
                            : 'bg-[#282233] text-[#d6c8b4]'
                        }`}
                      >
                        {n}P
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d6c8b4] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fillWithBots}
                      onChange={(e) => setFillWithBots(e.target.checked)}
                      className="accent-[#6eb5a4]"
                    />
                    <span>Bot Fill</span>
                  </label>
                </div>

                <button
                  type="button"
                  data-create-room="true"
                  onClick={() => {
                    onClearError();
                    onlineClient.createRoom(playerName, archetypeId, {
                      arenaId: createArenaId,
                      gameMode: createMode,
                      maxPlayers,
                      fillWithBots,
                    });
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-sm uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Room</span>
                </button>
              </div>
            </div>

            {/* Right Column: Join Code & Open Public Rooms */}
            <div className="p-4 rounded-xl bg-[#1c1724] border-2 border-[#120e17] flex flex-col gap-3">
              <div>
                <label
                  htmlFor="online-join-code"
                  className="block text-xs font-bold text-[#d6c8b4] mb-1"
                >
                  Join by 5-Letter Code
                </label>
                <div className="flex gap-2">
                  <input
                    id="online-join-code"
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABCDE"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#282233] border-2 border-[#120e17] font-mono-num text-sm font-bold uppercase text-[#f4ead5] focus:outline-none focus:border-[#6eb5a4]"
                  />
                  <button
                    type="button"
                    disabled={joinCode.trim().length < 4}
                    onClick={() => {
                      onClearError();
                      onlineClient.joinRoom(joinCode.trim(), playerName, archetypeId);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#6eb5a4] hover:bg-[#7ec4b3] disabled:opacity-45 text-[#141019] border-2 border-[#120e17] font-extrabold text-xs uppercase cursor-pointer"
                  >
                    Join
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t-2 border-[#120e17]">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#bcae9a]">
                  Active Rooms ({publicRooms.length})
                </span>
                <button
                  type="button"
                  onClick={refreshRooms}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#e8a848] hover:underline cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="flex-1 min-h-[180px] max-h-[260px] overflow-y-auto flex flex-col gap-2">
                {publicRooms.length === 0 ? (
                  <div className="m-auto text-center text-xs text-[#bcae9a] py-6">
                    No active rooms right now. Host one on the left and share the code!
                  </div>
                ) : (
                  publicRooms.map((rm) => {
                    const modeName =
                      GAME_MODES.find((m) => m.id === rm.gameMode)?.shortName ?? rm.gameMode;
                    const arenaName = createArenaConfig(rm.arenaId).name;
                    return (
                      <div
                        key={rm.code}
                        className="p-2.5 rounded-lg bg-[#262030] border-2 border-[#120e17] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-sm font-extrabold text-[#e8a848]">
                              {rm.code}
                            </span>
                            <span className="text-xs font-bold text-[#f4ead5]">{rm.hostName}</span>
                          </div>
                          <div className="text-[11px] text-[#bcae9a]">
                            {modeName} · {arenaName} · {rm.playerCount}/{rm.maxPlayers}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={rm.status === 'playing' || rm.playerCount >= rm.maxPlayers}
                          onClick={() => {
                            onClearError();
                            onlineClient.joinRoom(rm.code, playerName, archetypeId);
                          }}
                          className="px-3 py-1.5 rounded-md bg-[#6eb5a4] hover:bg-[#7ec4b3] disabled:opacity-40 text-[#141019] border-2 border-[#120e17] text-xs font-extrabold cursor-pointer"
                        >
                          {rm.status === 'playing' ? 'Live' : 'Join'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Active Room Waiting Lobby */
          <div className="mt-4 flex flex-col gap-4">
            <div className="p-3.5 rounded-xl bg-[#1c1724] border-2 border-[#120e17] flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#bcae9a]">
                  Share Room Code or Invite Link
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span
                    data-room-code={room.code}
                    className="font-mono-num text-2xl font-extrabold tracking-widest text-[#e8a848]"
                  >
                    {room.code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#332c3f] hover:bg-[#433a52] text-[#f4ead5] border-2 border-[#120e17] text-xs font-bold cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#7de0a5]" />
                        <span>Copied Link</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Invite URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-right text-xs text-[#d6c8b4]">
                <div className="font-bold text-[#f4ead5]">
                  {GAME_MODES.find((m) => m.id === room.settings.gameMode)?.name}
                </div>
                <div>
                  {createArenaConfig(room.settings.arenaId).name} ·{' '}
                  {room.settings.fillWithBots ? `Up to ${room.settings.maxPlayers} (Bot Fill)` : `${room.players.length} Human`}
                </div>
              </div>
            </div>

            {isHost && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#1c1724] border-2 border-[#120e17]">
                <div>
                  <label className="block text-[11px] font-bold text-[#bcae9a] mb-1">
                    Game Mode
                  </label>
                  <select
                    value={room.settings.gameMode}
                    onChange={(e) =>
                      onlineClient.updateSettings({ gameMode: e.target.value as GameMode })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#282233] border-2 border-[#120e17] text-xs font-bold text-[#f4ead5]"
                  >
                    {GAME_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#bcae9a] mb-1">
                    Arena Stage
                  </label>
                  <select
                    value={room.settings.arenaId}
                    onChange={(e) =>
                      onlineClient.updateSettings({ arenaId: e.target.value as ArenaId })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#282233] border-2 border-[#120e17] text-xs font-bold text-[#f4ead5]"
                  >
                    {PLAYABLE_ARENAS.map((id) => (
                      <option key={id} value={id}>
                        {createArenaConfig(id).name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {[2, 4, 6, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onlineClient.updateSettings({ maxPlayers: n })}
                        className={`px-2 py-1.5 rounded border-2 border-[#120e17] font-mono-num text-xs font-bold cursor-pointer ${
                          room.settings.maxPlayers === n
                            ? 'bg-[#e8a848] text-[#141019]'
                            : 'bg-[#282233] text-[#d6c8b4]'
                        }`}
                      >
                        {n}P
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onlineClient.updateSettings({ fillWithBots: !room.settings.fillWithBots })
                    }
                    className={`px-2.5 py-1.5 rounded border-2 border-[#120e17] text-xs font-bold cursor-pointer ${
                      room.settings.fillWithBots
                        ? 'bg-[#6eb5a4] text-[#141019]'
                        : 'bg-[#282233] text-[#d6c8b4]'
                    }`}
                  >
                    Bots {room.settings.fillWithBots ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            )}

            {/* Roster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {room.players.map((p) => {
                const arch =
                  FIGHTER_ARCHETYPES.find((a) => a.id === p.archetypeId) ?? FIGHTER_ARCHETYPES[0];
                const isMe = p.clientId === myClientId;
                return (
                  <div
                    key={p.clientId}
                    className={`p-3 rounded-lg border-2 border-[#120e17] flex items-center justify-between gap-2 ${
                      isMe ? 'bg-[#2f283b]' : 'bg-[#1c1724]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FighterCrest archetype={arch} size={38} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#f4ead5]">{p.name}</span>
                          {p.isHost && <Crown className="w-3.5 h-3.5 text-[#e8a848]" />}
                          {isMe && (
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#e8a848] text-[#141019]">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#bcae9a]">
                          {arch.name} · Slot {p.slot + 1}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {room.settings.gameMode === 'team_chaos' && (
                        <button
                          type="button"
                          disabled={!isMe}
                          onClick={() =>
                            onlineClient.updatePlayer({ teamId: p.teamId === 0 ? 1 : 0 })
                          }
                          className={`px-2 py-1 rounded border border-[#120e17] text-[10px] font-extrabold uppercase ${
                            p.teamId === 0
                              ? 'bg-[#d95d43] text-[#fff8eb]'
                              : 'bg-[#54a897] text-[#141019]'
                          } ${isMe ? 'cursor-pointer' : 'opacity-80'}`}
                        >
                          {p.teamId === 0 ? 'Crimson' : 'Teal'}
                        </button>
                      )}
                      <span
                        className={`px-2 py-1 rounded text-[11px] font-extrabold uppercase border border-[#120e17] ${
                          p.ready
                            ? 'bg-[#365448] text-[#eef7ee]'
                            : 'bg-[#332c3f] text-[#bcae9a]'
                        }`}
                      >
                        {p.ready ? 'Ready' : 'Waiting'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t-2 border-[#120e17] flex-wrap">
              <button
                type="button"
                onClick={() => onlineClient.leaveRoom()}
                className="px-4 py-2.5 rounded-lg bg-[#332c3f] hover:bg-[#433a52] text-[#f4ead5] border-2 border-[#120e17] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Room</span>
              </button>

              <div className="flex items-center gap-2.5">
                {!isHost && (
                  <button
                    type="button"
                    onClick={() => onlineClient.toggleReady()}
                    className={`px-5 py-2.5 rounded-lg border-2 border-[#120e17] font-display font-extrabold text-sm uppercase cursor-pointer ${
                      myMember?.ready
                        ? 'bg-[#365448] text-[#eef7ee]'
                        : 'bg-[#e8a848] text-[#141019]'
                    }`}
                  >
                    {myMember?.ready ? 'Ready ✓' : 'Mark Ready'}
                  </button>
                )}

                {isHost && (
                  <button
                    type="button"
                    data-online-start="true"
                    onClick={() => onlineClient.startMatch()}
                    className="px-6 py-2.5 rounded-lg bg-[#d95d43] hover:bg-[#e36c52] text-[#fff8eb] border-2 border-[#120e17] ink-shadow-sm font-display font-extrabold text-sm uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Online Match</span>
                    <Users className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

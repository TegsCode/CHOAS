import { useCallback, useEffect, useRef, useState } from 'react';
import { AcademyMapModal } from './components/AcademyMapModal';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { GameHud } from './components/GameHud';
import { MatchModal } from './components/MatchModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { ReplayControlsHud } from './components/ReplayControlsHud';
import { TitleScreen } from './components/TitleScreen';
import { TutorialHud } from './components/TutorialHud';
import { ACADEMY_LEVELS } from './game/academyLevels';
import { soundEngine } from './game/audio';
import { ChaosEngine, HudMatchMeta, MatchSetup, ReplaySnapshot } from './game/engine';
import {
  applyMatchResultToMissions,
  applySimEventsToMissions,
  claimMissionReward,
  DailyMissionStore,
  ensureDailyMissionStore,
  equipMechPalette,
  loadDailyMissionStore,
  saveDailyMissionStore,
} from './game/missions';
import type { RoomStatePayload } from './game/netTypes';
import { onlineClient } from './game/onlineClient';
import {
  FighterArchetypeId,
  GameScreenState,
  Handedness,
  HudFighterSummary,
  MatchResultSummary,
  MechId,
  TutorialMode,
  TutorialStepSnapshot,
} from './game/types';

const TUTORIAL_STORAGE_KEY = 'chaos_tutorial_done';
const ACADEMY_COMPLETED_KEY = 'chaos_academy_completed';
const ACADEMY_LEVEL_KEY = 'chaos_academy_level';
const HANDEDNESS_STORAGE_KEY = 'chaos_handedness';

const DEFAULT_SETUP: MatchSetup = {
  arenaId: 'meadow',
  gameMode: 'last_standing',
  fighterCount: 4,
  p1ArchetypeId: 'ember',
  p2Enabled: false,
  p2ArchetypeId: 'wraith',
};

const DEFAULT_META: HudMatchMeta = {
  gameMode: 'last_standing',
  timeLimitSeconds: null,
  teamScores: [0, 0],
  kingZone: null,
  p1EliminatedEarly: false,
  spectatorFast: false,
  onlineMode: false,
};

function readInitialCompletedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACADEMY_COMPLETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function readInitialAcademyIndex(): number {
  if (typeof window === 'undefined') return 0;
  const params = new URLSearchParams(window.location.search);
  const qLv = Number(params.get('level'));
  if (Number.isFinite(qLv) && qLv >= 1) {
    return Math.min(ACADEMY_LEVELS.length - 1, Math.floor(qLv) - 1);
  }
  try {
    const saved = Number(window.localStorage.getItem(ACADEMY_LEVEL_KEY));
    if (Number.isFinite(saved) && saved >= 0) {
      return Math.min(ACADEMY_LEVELS.length - 1, Math.floor(saved));
    }
  } catch {
    // ignore
  }
  return 0;
}

function readInitialRoomCode(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') ?? '').trim().toUpperCase().slice(0, 6);
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ChaosEngine | null>(null);

  const [screenState, setScreenState] = useState<GameScreenState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('autostart') === '1' ||
        params.get('tutorial') === '1' ||
        params.get('crucible') === '1'
      ) {
        return 'playing';
      }
    }
    return 'title';
  });

  const [inTutorial, setInTutorial] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tutorial') === '1' || params.get('crucible') === '1';
    }
    return false;
  });

  const [tutorialMode, setTutorialMode] = useState<TutorialMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('crucible') === '1') return 'crucible';
    }
    return 'basics';
  });

  const [handedness, setHandedness] = useState<Handedness>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(HANDEDNESS_STORAGE_KEY);
      if (saved === 'left' || saved === 'right') return saved;
    }
    return 'right';
  });

  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1';
    }
    return false;
  });

  const [completedLevelIds, setCompletedLevelIds] = useState<string[]>(readInitialCompletedIds);
  const [savedAcademyLevel, setSavedAcademyLevel] = useState<number>(readInitialAcademyIndex);
  const [showAcademyMap, setShowAcademyMap] = useState<boolean>(false);

  const [missionStore, setMissionStore] = useState<DailyMissionStore>(() => loadDailyMissionStore());
  const [showDailyMissions, setShowDailyMissions] = useState<boolean>(false);
  const [dailyMissionsTab, setDailyMissionsTab] = useState<'missions' | 'palettes'>('missions');

  const [initialRoomCode] = useState<string>(readInitialRoomCode);
  const [showOnlineLobby, setShowOnlineLobby] = useState<boolean>(() => Boolean(readInitialRoomCode()));
  const [onlineRoom, setOnlineRoom] = useState<RoomStatePayload | null>(null);
  const [onlineClientId, setOnlineClientId] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isOnlineMatch, setIsOnlineMatch] = useState<boolean>(false);

  const [tutorialSnapshot, setTutorialSnapshot] = useState<TutorialStepSnapshot | null>(null);
  const [replaySnapshot, setReplaySnapshot] = useState<ReplaySnapshot | null>(null);
  const [setup, setSetup] = useState<MatchSetup>(DEFAULT_SETUP);
  const setupRef = useRef<MatchSetup>(DEFAULT_SETUP);
  const screenRef = useRef<GameScreenState>(screenState);
  const inTutorialRef = useRef<boolean>(inTutorial);
  const tutorialModeRef = useRef<TutorialMode>(tutorialMode);
  const handednessRef = useRef<Handedness>(handedness);
  const savedAcademyLevelRef = useRef<number>(savedAcademyLevel);
  const completedLevelIdsRef = useRef<string[]>(completedLevelIds);
  const showAcademyMapRef = useRef<boolean>(showAcademyMap);
  const showDailyMissionsRef = useRef<boolean>(showDailyMissions);
  const missionStoreRef = useRef<DailyMissionStore>(missionStore);
  const showOnlineLobbyRef = useRef<boolean>(showOnlineLobby);
  const isOnlineMatchRef = useRef<boolean>(isOnlineMatch);

  const [hudFighters, setHudFighters] = useState<HudFighterSummary[]>([]);
  const [hudMeta, setHudMeta] = useState<HudMatchMeta>(DEFAULT_META);
  const [elapsed, setElapsed] = useState(0);
  const [escalation, setEscalation] = useState(0);
  const [sfxMuted, setSfxMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [musicMuted, setMusicMuted] = useState<boolean>(() => soundEngine.isMusicMuted());
  const [result, setResult] = useState<MatchResultSummary | null>(null);
  const [mechBanner, setMechBanner] = useState<{
    id: number;
    fighterName: string;
    mechId: MechId;
    color: string;
  } | null>(null);
  const bannerTimerRef = useRef<number>(0);

  useEffect(() => {
    screenRef.current = screenState;
    document.body.dataset.state = screenState;
  }, [screenState]);

  useEffect(() => {
    inTutorialRef.current = inTutorial;
  }, [inTutorial]);

  useEffect(() => {
    tutorialModeRef.current = tutorialMode;
  }, [tutorialMode]);

  useEffect(() => {
    handednessRef.current = handedness;
  }, [handedness]);

  useEffect(() => {
    savedAcademyLevelRef.current = savedAcademyLevel;
  }, [savedAcademyLevel]);

  useEffect(() => {
    completedLevelIdsRef.current = completedLevelIds;
  }, [completedLevelIds]);

  useEffect(() => {
    showOnlineLobbyRef.current = showOnlineLobby;
  }, [showOnlineLobby]);

  useEffect(() => {
    isOnlineMatchRef.current = isOnlineMatch;
  }, [isOnlineMatch]);

  useEffect(() => {
    showAcademyMapRef.current = showAcademyMap;
  }, [showAcademyMap]);

  useEffect(() => {
    showDailyMissionsRef.current = showDailyMissions;
  }, [showDailyMissions]);

  useEffect(() => {
    missionStoreRef.current = missionStore;
    saveDailyMissionStore(missionStore);
    engineRef.current?.setEquippedMechPalettes(missionStore.equippedPalettes);
  }, [missionStore]);

  const handleOpenDailyMissions = useCallback((tab: 'missions' | 'palettes' = 'missions') => {
    const synced = ensureDailyMissionStore(missionStoreRef.current);
    if (synced !== missionStoreRef.current) {
      missionStoreRef.current = synced;
      saveDailyMissionStore(synced);
      setMissionStore(synced);
    }
    setDailyMissionsTab(tab);
    setShowDailyMissions(true);
  }, []);

  const handleClaimMission = useCallback((missionId: string) => {
    const current = ensureDailyMissionStore(missionStoreRef.current);
    const { store: nextStore } = claimMissionReward(current, missionId, true);
    if (nextStore !== missionStoreRef.current) {
      missionStoreRef.current = nextStore;
      saveDailyMissionStore(nextStore);
      engineRef.current?.setEquippedMechPalettes(nextStore.equippedPalettes);
      setMissionStore(nextStore);
    }
  }, []);

  const handleEquipPalette = useCallback((mechId: MechId, paletteId: string) => {
    const current = ensureDailyMissionStore(missionStoreRef.current);
    const nextStore = equipMechPalette(current, mechId, paletteId);
    if (nextStore !== missionStoreRef.current) {
      missionStoreRef.current = nextStore;
      saveDailyMissionStore(nextStore);
      engineRef.current?.setEquippedMechPalettes(nextStore.equippedPalettes);
      setMissionStore(nextStore);
    }
  }, []);

  const handleChangeHandedness = useCallback((next: Handedness) => {
    setHandedness(next);
    handednessRef.current = next;
    try {
      window.localStorage.setItem(HANDEDNESS_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    engineRef.current?.setHandedness(next);
  }, []);

  const handleStart = useCallback(() => {
    soundEngine.unlockAndStartMusic();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowAcademyMap(false);
    setShowDailyMissions(false);
    setShowOnlineLobby(false);
    setIsOnlineMatch(false);
    setResult(null);
    setMechBanner(null);
    setReplaySnapshot(null);
    setInTutorial(false);
    setTutorialSnapshot(null);
    setScreenState('playing');
    engineRef.current?.startMatch(setupRef.current);
  }, []);

  const handleStartTutorial = useCallback((mode: TutorialMode, explicitStartIdx?: number) => {
    soundEngine.unlockAndStartMusic();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowAcademyMap(false);
    setShowDailyMissions(false);
    setShowOnlineLobby(false);
    setIsOnlineMatch(false);
    setResult(null);
    setMechBanner(null);
    setReplaySnapshot(null);
    setTutorialMode(mode);
    tutorialModeRef.current = mode;
    setInTutorial(true);
    inTutorialRef.current = true;
    setScreenState('playing');

    const startIdx =
      explicitStartIdx !== undefined
        ? explicitStartIdx
        : mode === 'basics'
          ? savedAcademyLevelRef.current
          : 0;
    engineRef.current?.startTutorial(
      setupRef.current,
      mode,
      handednessRef.current,
      startIdx,
      completedLevelIdsRef.current
    );
  }, []);

  const handleRestartCurrent = useCallback(() => {
    if (isOnlineMatchRef.current) return;
    if (inTutorialRef.current) {
      if (tutorialModeRef.current === 'basics' && tutorialSnapshot) {
        engineRef.current?.jumpToTutorialLevel(tutorialSnapshot.stepIndex);
        setResult(null);
        setScreenState('playing');
      } else {
        handleStartTutorial(tutorialModeRef.current);
      }
    } else {
      handleStart();
    }
  }, [handleStart, handleStartTutorial, tutorialSnapshot]);

  const handleJumpToAcademyLevel = useCallback(
    (levelIndex: number) => {
      setShowAcademyMap(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (!inTutorialRef.current || tutorialModeRef.current !== 'basics' || screenRef.current === 'title') {
        handleStartTutorial('basics', levelIndex);
        return;
      }
      engineRef.current?.jumpToTutorialLevel(levelIndex);
      engineRef.current?.setScreenState('playing');
      setScreenState('playing');
    },
    [handleStartTutorial]
  );

  const handleOpenAcademyMap = useCallback(() => {
    setShowAcademyMap(true);
    if (screenRef.current === 'playing') {
      engineRef.current?.setScreenState('paused');
    }
  }, []);

  const handleCloseAcademyMap = useCallback(() => {
    setShowAcademyMap(false);
    if (screenRef.current === 'playing') {
      engineRef.current?.setScreenState('playing');
    }
  }, []);

  const handleChangeSetup = useCallback((next: MatchSetup) => {
    setSetup(next);
    setupRef.current = next;
    if (screenRef.current === 'title') {
      engineRef.current?.startDemoArena(next);
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    if (showAcademyMap) {
      handleCloseAcademyMap();
      return;
    }
    if (screenRef.current === 'playing') {
      setScreenState('paused');
      engineRef.current?.setScreenState('paused');
    } else if (screenRef.current === 'paused') {
      setScreenState('playing');
      engineRef.current?.setScreenState('playing');
    }
  }, [handleCloseAcademyMap, showAcademyMap]);

  const handleBackToTitle = useCallback(() => {
    if (isOnlineMatchRef.current) {
      onlineClient.leaveRoom();
      engineRef.current?.stopOnlineMatch();
      setIsOnlineMatch(false);
      setOnlineRoom(null);
    }
    setShowAcademyMap(false);
    setShowOnlineLobby(false);
    setResult(null);
    setMechBanner(null);
    setReplaySnapshot(null);
    setInTutorial(false);
    setTutorialSnapshot(null);
    setScreenState('title');
    engineRef.current?.startDemoArena(setupRef.current);
  }, []);

  const handleToggleSfxMute = useCallback(() => {
    soundEngine.unlockAndStartMusic();
    setSfxMuted(soundEngine.toggleMute());
  }, []);

  const handleToggleMusicMute = useCallback(() => {
    soundEngine.unlockAndStartMusic();
    setMusicMuted(soundEngine.toggleMusicMute());
  }, []);

  const handleStartReplay = useCallback((koOnly: boolean) => {
    if (engineRef.current?.startReplay(koOnly)) {
      setScreenState('replay');
    }
  }, []);

  const handleExitReplay = useCallback(() => {
    engineRef.current?.stopReplay();
    engineRef.current?.setScreenState('gameover');
    setReplaySnapshot(null);
    setScreenState('gameover');
  }, []);

  // Wire OnlineClient WebSocket callbacks
  useEffect(() => {
    onlineClient.setCallbacks({
      onRoomState: (room, clientId) => {
        setOnlineRoom(room);
        if (clientId) setOnlineClientId(clientId);
        if (room && room.status === 'lobby' && isOnlineMatchRef.current) {
          engineRef.current?.stopOnlineMatch();
          setIsOnlineMatch(false);
          setResult(null);
          setReplaySnapshot(null);
          setScreenState('title');
          setShowOnlineLobby(true);
          engineRef.current?.startDemoArena(setupRef.current);
        }
      },
      onMatchStarted: (room, mySlot) => {
        setOnlineRoom(room);
        setShowOnlineLobby(false);
        setShowAcademyMap(false);
        setInTutorial(false);
        setResult(null);
        setMechBanner(null);
        setReplaySnapshot(null);
        setIsOnlineMatch(true);
        isOnlineMatchRef.current = true;
        setScreenState('playing');
        engineRef.current?.startOnlineMatch(room, mySlot);
      },
      onSimSnapshot: (frame) => {
        engineRef.current?.applyOnlineFrame(frame);
      },
      onMatchOver: (res) => {
        const current = ensureDailyMissionStore(missionStoreRef.current);
        const { store: nextStore } = applyMatchResultToMissions(
          current,
          res,
          res.arenaId ?? setupRef.current.arenaId
        );
        if (nextStore !== missionStoreRef.current) {
          missionStoreRef.current = nextStore;
          saveDailyMissionStore(nextStore);
          setMissionStore(nextStore);
        }
        setResult(res);
        setScreenState('gameover');
        engineRef.current?.setScreenState('gameover');
      },
      onError: (msg) => {
        setOnlineError(msg);
      },
    });
  }, []);

  // Mount Canvas2D engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new ChaosEngine(
      container,
      setupRef.current,
      {
        onHudUpdate: (fighters, time, esc, meta) => {
          setHudFighters(fighters);
          setElapsed(time);
          setEscalation(esc);
          setHudMeta(meta);
        },
        onMechBanner: (fighterName, mechId, color) => {
          const id = Date.now() + Math.random();
          setMechBanner({ id, fighterName, mechId, color });
          window.clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = window.setTimeout(() => {
            setMechBanner((prev) => (prev && prev.id === id ? null : prev));
          }, 1350);
        },
        onMatchOver: (res) => {
          const current = ensureDailyMissionStore(missionStoreRef.current);
          const { store: nextStore } = applyMatchResultToMissions(
            current,
            res,
            res.arenaId ?? setupRef.current.arenaId
          );
          if (nextStore !== missionStoreRef.current) {
            missionStoreRef.current = nextStore;
            saveDailyMissionStore(nextStore);
            setMissionStore(nextStore);
          }
          setResult(res);
          setScreenState('gameover');
        },
        onSimEvents: (events, humanIds, isTut) => {
          const current = ensureDailyMissionStore(missionStoreRef.current);
          const { store: nextStore } = applySimEventsToMissions(current, events, humanIds, isTut);
          if (nextStore !== missionStoreRef.current) {
            missionStoreRef.current = nextStore;
            saveDailyMissionStore(nextStore);
            setMissionStore(nextStore);
          }
        },
        onReplayUpdate: (snap) => {
          setReplaySnapshot(snap);
        },
        onTutorialUpdate: (snap) => {
          setTutorialSnapshot(snap);
          if (snap && snap.mode === 'basics') {
            if (!snap.reroutedFrom) {
              setSavedAcademyLevel(snap.stepIndex);
              savedAcademyLevelRef.current = snap.stepIndex;
              try {
                window.localStorage.setItem(ACADEMY_LEVEL_KEY, String(snap.stepIndex));
              } catch {
                // ignore
              }
            }
            if (snap.completedLevelIds) {
              setCompletedLevelIds(snap.completedLevelIds);
              completedLevelIdsRef.current = snap.completedLevelIds;
              try {
                window.localStorage.setItem(
                  ACADEMY_COMPLETED_KEY,
                  JSON.stringify(snap.completedLevelIds)
                );
              } catch {
                // ignore
              }
            }
          }
          if (snap?.completed) {
            setTutorialCompleted(true);
            try {
              window.localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
              if (snap.mode === 'basics') {
                window.localStorage.setItem(ACADEMY_LEVEL_KEY, '0');
                setSavedAcademyLevel(0);
              }
            } catch {
              // ignore storage errors
            }
            setScreenState('gameover');
          }
        },
      },
      handednessRef.current
    );

    engineRef.current = engine;
    engine.setEquippedMechPalettes(missionStoreRef.current.equippedPalettes);

    if (screenRef.current === 'playing') {
      if (inTutorialRef.current) {
        engine.startTutorial(
          setupRef.current,
          tutorialModeRef.current,
          handednessRef.current,
          tutorialModeRef.current === 'basics' ? savedAcademyLevelRef.current : 0,
          completedLevelIdsRef.current
        );
      } else {
        engine.startMatch(setupRef.current);
      }
    }

    return () => {
      window.clearTimeout(bannerTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Global shell hotkeys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showDailyMissionsRef.current) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowDailyMissions(false);
        }
        return;
      }
      if (showOnlineLobbyRef.current || showAcademyMapRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (screenRef.current === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenRef.current === 'playing' || screenRef.current === 'paused') {
          e.preventDefault();
          handleTogglePause();
        } else if (screenRef.current === 'replay') {
          e.preventDefault();
          handleExitReplay();
        }
      } else if (e.code === 'KeyM') {
        if (screenRef.current === 'playing' || screenRef.current === 'paused') {
          handleToggleSfxMute();
        }
      } else if (e.code === 'KeyR') {
        if (
          !isOnlineMatchRef.current &&
          (screenRef.current === 'playing' ||
            screenRef.current === 'paused' ||
            screenRef.current === 'gameover')
        ) {
          e.preventDefault();
          handleRestartCurrent();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleExitReplay,
    handleRestartCurrent,
    handleStart,
    handleTogglePause,
    handleToggleSfxMute,
  ]);

  const myOnlineMember = onlineRoom?.players.find((p) => p.clientId === onlineClientId) ?? null;
  const claimableMissions = missionStore.missions.filter((m) => m.completed && !m.claimed);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#1b1722]">
      {/* Isolated Canvas2D game viewport */}
      <div ref={mountRef} className="fixed inset-0 z-0" />

      {screenState === 'title' && (
        <TitleScreen
          setup={setup}
          handedness={handedness}
          tutorialCompleted={tutorialCompleted}
          savedAcademyLevel={savedAcademyLevel}
          academyTotal={ACADEMY_LEVELS.length}
          sfxMuted={sfxMuted}
          musicMuted={musicMuted}
          missionStore={missionStore}
          onChangeSetup={handleChangeSetup}
          onChangeHandedness={handleChangeHandedness}
          onToggleSfxMute={handleToggleSfxMute}
          onToggleMusicMute={handleToggleMusicMute}
          onStart={handleStart}
          onStartTutorial={(mode) => handleStartTutorial(mode)}
          onOpenAcademyMap={handleOpenAcademyMap}
          onOpenOnlineLobby={() => {
            soundEngine.unlockAndStartMusic();
            setShowOnlineLobby(true);
          }}
          onOpenDailyMissions={handleOpenDailyMissions}
        />
      )}

      {(screenState === 'playing' || screenState === 'paused') && (
        <GameHud
          fighters={hudFighters}
          elapsed={elapsed}
          escalation={escalation}
          meta={hudMeta}
          sfxMuted={sfxMuted}
          musicMuted={musicMuted}
          mechBanner={mechBanner}
          onToggleSfxMute={handleToggleSfxMute}
          onToggleMusicMute={handleToggleMusicMute}
          onPause={handleTogglePause}
          onRestart={handleRestartCurrent}
          onToggleSpectatorSpeed={() => engineRef.current?.toggleSpectatorSpeed()}
          onSkipSpectating={() => engineRef.current?.skipSpectating()}
        />
      )}

      {screenState === 'replay' && replaySnapshot && (
        <ReplayControlsHud
          snapshot={replaySnapshot}
          onTogglePause={() => engineRef.current?.toggleReplayPause()}
          onSetSpeed={(spd) => engineRef.current?.setReplaySpeed(spd)}
          onSeekFrame={(idx) => engineRef.current?.seekReplay(idx)}
          onJumpKo={(d) => engineRef.current?.jumpToKo(d)}
          onExit={handleExitReplay}
        />
      )}

      {screenState === 'playing' && inTutorial && tutorialSnapshot && !tutorialSnapshot.completed && (
        <TutorialHud
          snapshot={tutorialSnapshot}
          handedness={handedness}
          onChangeHandedness={handleChangeHandedness}
          onOpenLevelMap={handleOpenAcademyMap}
          onJumpToLevel={handleJumpToAcademyLevel}
          onSkipToArena={handleStart}
        />
      )}

      {showAcademyMap && (
        <AcademyMapModal
          currentLevelIndex={tutorialSnapshot?.stepIndex ?? savedAcademyLevel}
          completedLevelIds={tutorialSnapshot?.completedLevelIds ?? completedLevelIds}
          reroutedFrom={tutorialSnapshot?.reroutedFrom}
          onSelectLevel={handleJumpToAcademyLevel}
          onClose={handleCloseAcademyMap}
        />
      )}

      <OnlineLobbyModal
        open={showOnlineLobby}
        room={onlineRoom}
        myClientId={onlineClientId}
        initialArenaId={setup.arenaId}
        initialGameMode={setup.gameMode}
        initialArchetypeId={setup.p1ArchetypeId as FighterArchetypeId}
        initialJoinCode={initialRoomCode}
        errorMessage={onlineError}
        onClearError={() => setOnlineError(null)}
        onClose={() => setShowOnlineLobby(false)}
      />

      {showDailyMissions && (
        <DailyMissionsModal
          store={missionStore}
          initialTab={dailyMissionsTab}
          onClaimMission={handleClaimMission}
          onEquipPalette={handleEquipPalette}
          onClose={() => setShowDailyMissions(false)}
        />
      )}

      {(screenState === 'paused' || screenState === 'gameover') &&
        !showAcademyMap &&
        !showOnlineLobby &&
        !showDailyMissions && (
          <MatchModal
            screenState={screenState}
            result={result}
            tutorialComplete={Boolean(inTutorial && tutorialSnapshot?.completed)}
            tutorialMode={tutorialMode}
            handedness={handedness}
            p2Enabled={setup.p2Enabled}
            sfxMuted={sfxMuted}
            musicMuted={musicMuted}
            hasReplay={!inTutorial && Boolean(engineRef.current?.hasReplayFrames())}
            isOnlineMatch={isOnlineMatch}
            isOnlineHost={Boolean(myOnlineMember?.isHost)}
            claimableMissions={claimableMissions}
            onClaimMission={handleClaimMission}
            onOpenDailyMissions={() => handleOpenDailyMissions('palettes')}
            onChangeHandedness={handleChangeHandedness}
            onToggleSfxMute={handleToggleSfxMute}
            onToggleMusicMute={handleToggleMusicMute}
            onResume={handleTogglePause}
            onRestart={
              inTutorial && tutorialSnapshot?.completed && tutorialMode === 'basics'
                ? () => handleStartTutorial('basics', 0)
                : handleRestartCurrent
            }
            onStartReplay={handleStartReplay}
            onAdvanceToCrucible={() => handleStartTutorial('crucible')}
            onEnterArenaFromTutorial={handleStart}
            onOnlineRematch={() => onlineClient.rematch()}
            onBackToTitle={handleBackToTitle}
          />
        )}
    </main>
  );
}

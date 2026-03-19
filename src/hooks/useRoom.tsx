import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAuthApi, getLobbyApi, getLobbySessionFactory, getRuntimeSession, launchAssignedMatch, launchGameMode, normalizeGameMode, roomCodeFromRoomId, currentActivityState } from '@/integration/runtime';

export const MAX_PLAYERS = 16;

type RoomMode = 'ffa' | 'tdm' | 'lms';

export interface MatchStats {
  kills: number;
  deaths: number;
  assists: number;
}

export interface MatchResult {
  isWinner: boolean;
  placement: number;
  totalPlayers: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isCreator: boolean;
  isReady: boolean;
}

export interface DisconnectedPlayer {
  player: RoomPlayer;
  disconnectedAt: number;
  remainingMs: number;
}

interface FriendView {
  userId: string;
  name: string;
  status: 'online' | 'away' | 'offline';
  inGame: boolean;
  incomingInvite: boolean;
  outgoingInvite: boolean;
  canJoin: boolean;
  canInvite: boolean;
  sameParty: boolean;
}

interface PartyMemberView {
  id: string;
  name: string;
  isLeader: boolean;
}

interface PendingInvite {
  from: string;
  roomCode: string;
}

interface RoomState {
  isInRoom: boolean;
  roomCode: string;
  mode: RoomMode;
  teamCount: number;
  isLocked: boolean;
  isCreator: boolean;
  players: RoomPlayer[];
  teams: Record<number, RoomPlayer[]>;
  selectedPlayer: RoomPlayer | null;
  pendingInvites: PendingInvite[];
  matchState: 'idle' | 'countdown' | 'in-match' | 'post-match';
  countdownValue: number;
  readyPlayers: Set<string>;
  disconnectedPlayers: Map<string, DisconnectedPlayer>;
  isPaused: boolean;
  matchStats: MatchStats;
  matchResult: MatchResult | null;
  friends: FriendView[];
  partyMembers: PartyMemberView[];
  isPartyLeader: boolean;
  awaitingInputCapture: boolean;
  busyMessage: string;
  partyStatusText: string;
  friendsStatusText: string;
  roomStatusText: string;
  createRoom: (creatorName: string, creatorId: string) => Promise<any>;
  joinRoom: (code: string, playerName: string, playerId: string) => Promise<any>;
  leaveRoom: () => Promise<any>;
  setMode: (mode: RoomMode) => Promise<any>;
  setTeamCount: (count: number) => Promise<any>;
  toggleLock: () => Promise<any>;
  inviteParty: () => Promise<any>;
  invitePlayer: (name: string) => Promise<any>;
  selectPlayer: (player: RoomPlayer | null) => void;
  assignToTeam: (teamIdx: number) => Promise<any>;
  movePlayer: (playerId: string, fromTeam: number, toTeam: number) => Promise<any>;
  randomizeTeams: () => Promise<any>;
  startMatch: () => Promise<any>;
  toggleReady: (playerId: string) => void;
  acceptInvite: (roomCode: string) => Promise<any>;
  dismissInvite: (roomCode: string) => Promise<any>;
  addMockInvite: () => void;
  togglePause: () => Promise<any>;
  kickPlayer: (playerId: string) => Promise<any>;
  startPartyMatch: (partyMembers: { id: string; name: string }[]) => Promise<any>;
  endMatch: () => void;
  returnToLobby: () => Promise<any>;
  returnToMenu: () => Promise<any>;
  launchQuickPlay: (modeId: string) => Promise<any>;
  inviteFriendById: (targetId: string) => Promise<any>;
  joinFriendById: (targetId: string) => Promise<any>;
  addFriend: (targetId: string) => Promise<any>;
  removeFriend: (targetId: string) => Promise<any>;
  inviteFriend: (targetId: string) => Promise<any>;
  joinFriend: (targetId: string) => Promise<any>;
  leaveParty: () => Promise<any>;
  acceptPartyInvite: (targetId: string) => Promise<any>;
  dismissPartyInvite: (targetId: string) => Promise<any>;
  enterGameplay: (event?: Event | React.SyntheticEvent | null) => Promise<any>;
}

const RoomContext = createContext<RoomState | null>(null);

function toRoomPlayer(member: any, readyPlayers: Set<string>): RoomPlayer {
  const id = String(member?.id || member?.userId || '');
  return {
    id,
    name: String(member?.displayName || member?.username || id || 'PLAYER'),
    isCreator: !!member?.isHost,
    isReady: readyPlayers.has(id),
  };
}

function deriveFriendStatus(friend: any): FriendView['status'] {
  if (!friend?.online) return 'offline';
  if (String(friend.activityState || '') === 'in_match') return 'online';
  if (String(friend.activityState || '') === 'menu') return 'online';
  return 'away';
}

function didSelfWin(matchState: any, selfState: any) {
  if (!matchState || !selfState) return false;
  if (String(matchState.gameMode || '') === 'tdm') {
    return String(selfState.teamId || '') === String(matchState.winnerTeam || '');
  }
  return String(matchState.winnerId || '') === String(selfState.id || '');
}

function deriveMatchResult(snapshot: any): MatchResult | null {
  const matchState = snapshot?.matchState || null;
  const selfState = snapshot?.selfState || null;
  if (!matchState || !selfState) return null;
  const totalPlayers = Math.max(1, Number(matchState.playerCount || matchState.totalPlayers || 1));
  const placement = Number(selfState.placement || (didSelfWin(matchState, selfState) ? 1 : totalPlayers));
  return {
    isWinner: didSelfWin(matchState, selfState),
    placement: Number.isFinite(placement) ? placement : totalPlayers,
    totalPlayers,
  };
}

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sessionRef = useRef<any>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const [partyState, setPartyState] = useState<any>(null);
  const [friendsState, setFriendsState] = useState<any>({ friends: [] });
  const [privateRoomState, setPrivateRoomState] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<RoomPlayer | null>(null);
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [countdownValue, setCountdownValue] = useState(3);
  const [countdownActive, setCountdownActive] = useState(false);
  const [sessionState, setSessionState] = useState<any>({
    runtimeReady: false,
    inMatch: false,
    awaitingInputCapture: false,
    canResume: false,
    activityState: 'menu',
    launchContext: {},
    pauseState: { active: false },
    postGame: null,
  });
  const [busyMessage, setBusyMessage] = useState('');
  const [partyStatus, setPartyStatus] = useState({ text: '', error: false });
  const [friendsStatus, setFriendsStatus] = useState({ text: '', error: false });
  const [roomStatus, setRoomStatus] = useState({ text: '', error: false });

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownActive(false);
  }, []);

  useEffect(() => {
    const factory = getLobbySessionFactory();
    if (!factory?.create || sessionRef.current) return;

    sessionRef.current = factory.create({
      lobbyApi: getLobbyApi(),
      authApi: getAuthApi(),
      getActivityState: currentActivityState,
      setPartyStatus(text: string, isErr: boolean) {
        setPartyStatus({ text: String(text || ''), error: !!isErr });
      },
      setFriendsStatus(text: string, isErr: boolean) {
        setFriendsStatus({ text: String(text || ''), error: !!isErr });
      },
      setPrivateRoomStatus(text: string, isErr: boolean) {
        setRoomStatus({ text: String(text || ''), error: !!isErr });
      },
      onBusyChange(nextBusy: boolean, message: string) {
        setBusyMessage(nextBusy ? String(message || '') : '');
      },
      onPartyStateChanged(nextState: any) {
        setPartyState(nextState || null);
      },
      onFriendsStateChanged(nextState: any) {
        setFriendsState(nextState || { friends: [] });
      },
      onPrivateRoomStateChanged(nextState: any) {
        setPrivateRoomState(nextState || null);
      },
      onPartyUnavailable(message: string) {
        setPartyStatus({ text: String(message || ''), error: true });
      },
      onFriendsUnavailable(message: string) {
        setFriendsStatus({ text: String(message || ''), error: true });
      },
      onPrivateRoomUnavailable(message: string) {
        setRoomStatus({ text: String(message || ''), error: true });
      },
      launchAssignedMatch(nextState: any) {
        launchAssignedMatch(nextState).catch(() => null);
      },
    });

    sessionRef.current.start?.();
    sessionRef.current.refreshBackgroundState?.();

    return () => {
      clearCountdown();
      sessionRef.current?.stop?.();
      sessionRef.current = null;
    };
  }, [clearCountdown]);

  useEffect(() => {
    const handleSession = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setSessionState({
        runtimeReady: !!detail.runtimeReady,
        inMatch: !!detail.inMatch,
        awaitingInputCapture: !!detail.awaitingInputCapture,
        canResume: !!detail.canResume,
        activityState: String(detail.activityState || 'menu'),
        launchContext: detail.launchContext || {},
        pauseState: detail.pauseState || { active: false },
        postGame: detail.postGame || null,
      });
      if (detail.postGame?.active || detail.activityState === 'paused' || detail.activityState === 'in_match') {
        clearCountdown();
      }
    };

    const handleAuth = () => {
      sessionRef.current?.refreshBackgroundState?.();
    };

    window.addEventListener('mayhem-session-state', handleSession as EventListener);
    window.addEventListener('mayhem-auth-changed', handleAuth);
    return () => {
      window.removeEventListener('mayhem-session-state', handleSession as EventListener);
      window.removeEventListener('mayhem-auth-changed', handleAuth);
    };
  }, [clearCountdown]);

  const privateRoom = privateRoomState?.room || null;
  const privateRoomSelf = privateRoomState?.self || null;
  const teamIds: string[] = useMemo(() => {
    if (Array.isArray(privateRoom?.teamIds) && privateRoom.teamIds.length) {
      return privateRoom.teamIds.map((teamId: string) => String(teamId));
    }
    const count = Math.max(2, Number(privateRoom?.teamCount || 2));
    return ['alpha', 'bravo', 'charlie', 'delta'].slice(0, count);
  }, [privateRoom]);

  const partyMembers = useMemo<PartyMemberView[]>(() => {
    const members = Array.isArray(partyState?.party?.members) ? partyState.party.members : [];
    return members.map((member: any) => ({
      id: String(member?.id || member?.userId || ''),
      name: String(member?.displayName || member?.username || member?.id || 'PLAYER'),
      isLeader: !!member?.isLeader,
    }));
  }, [partyState]);

  const friends = useMemo<FriendView[]>(() => {
    const list = Array.isArray(friendsState?.friends) ? friendsState.friends : [];
    return list.map((friend: any) => ({
      userId: String(friend?.userId || friend?.id || ''),
      name: String(friend?.displayName || friend?.username || friend?.userId || 'FRIEND'),
      status: deriveFriendStatus(friend),
      inGame: String(friend?.activityState || '') === 'in_match',
      incomingInvite: !!friend?.incomingInvite,
      outgoingInvite: !!friend?.outgoingInvite,
      canJoin: !!friend?.canJoin,
      canInvite: !!friend?.canInvite,
      sameParty: !!friend?.sameParty,
    }));
  }, [friendsState]);

  const players = useMemo<RoomPlayer[]>(() => {
    const members = Array.isArray(privateRoom?.members) ? privateRoom.members : [];
    return members.map((member: any) => toRoomPlayer(member, readyPlayers));
  }, [privateRoom, readyPlayers]);

  const teams = useMemo<Record<number, RoomPlayer[]>>(() => {
    const next: Record<number, RoomPlayer[]> = {};
    teamIds.forEach((_teamId, index) => {
      next[index] = [];
    });
    const members = Array.isArray(privateRoom?.members) ? privateRoom.members : [];
    members.forEach((member: any) => {
      const idx = teamIds.findIndex((teamId) => String(member?.teamId || '') === teamId);
      if (idx >= 0) next[idx].push(toRoomPlayer(member, readyPlayers));
    });
    return next;
  }, [privateRoom, teamIds, readyPlayers]);

  const pendingInvites = useMemo<PendingInvite[]>(() => {
    const incoming = partyState?.roomInvite?.incoming || null;
    if (!incoming) return [];
    return [{
      from: String(incoming.inviterDisplayName || incoming.inviterActorId || 'PLAYER'),
      roomCode: String(incoming.roomCode || roomCodeFromRoomId(incoming.roomId || '')),
    }];
  }, [partyState]);

  const matchStats = useMemo<MatchStats>(() => {
    const snapshot = sessionState.postGame?.snapshot || null;
    const selfState = snapshot?.selfState || null;
    return {
      kills: Number(selfState?.kills || 0),
      deaths: Number(selfState?.deaths || 0),
      assists: Number(selfState?.assists || 0),
    };
  }, [sessionState]);

  const matchResult = useMemo<MatchResult | null>(() => deriveMatchResult(sessionState.postGame?.snapshot || null), [sessionState]);

  const matchState = useMemo<RoomState['matchState']>(() => {
    if (sessionState.postGame?.active) return 'post-match';
    if (countdownActive) return 'countdown';
    if (sessionState.activityState === 'paused' || sessionState.activityState === 'in_match') return 'in-match';
    return 'idle';
  }, [sessionState, countdownActive]);

  const isPartyLeader = !!partyState?.party?.isLeader || !!partyMembers.find((member) => member.isLeader);
  const capabilities = sessionRef.current?.getCapabilities?.() || {};
  const isInRoom = !!privateRoom;
  const isCreator = !!privateRoomSelf?.isHost || !!capabilities.canEditPrivateRoom;
  const isLocked = !!(privateRoom?.inviteLocked ?? capabilities.privateRoomInviteLocked);
  const isPaused = !!sessionState.pauseState?.active || sessionState.activityState === 'paused';
  const roomCode = String(privateRoom?.roomCode || roomCodeFromRoomId(privateRoom?.roomId || ''));
  const mode = String(privateRoom?.roomMode || 'ffa') as RoomMode;
  const teamCount = Math.max(2, Number(privateRoom?.teamCount || teamIds.length || 2));

  const startCountdown = useCallback(() => {
    clearCountdown();
    setCountdownActive(true);
    setCountdownValue(3);
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownValue((current) => {
        if (current <= 1) {
          clearCountdown();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, [clearCountdown]);

  const launchQuickPlay = useCallback(async (modeId: string) => {
    const modeValue = normalizeGameMode(modeId);
    const menuLoadout = (globalThis as any).__MAYHEM_RUNTIME?.GameMenuLoadout;
    const validation = menuLoadout?.validateSelections?.() || { ok: true, message: '' };
    if (!validation.ok) {
      throw new Error(validation.message || 'Loadout incomplete.');
    }
    menuLoadout?.syncToRuntime?.(false);
    if (modeValue === 'practice') {
      return launchGameMode('single_full_sandbox', { gameMode: 'ffa' });
    }
    const lobbyApi = getLobbyApi();
    const actor = getAuthApi()?.getPartyIdentity?.();
    const payload = await lobbyApi.requestJson(lobbyApi.matchmakingPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'quick',
        gameMode: modeValue,
        actorId: actor?.id ? String(actor.id) : '',
        displayName: actor?.username ? String(actor.username) : '',
      }),
    });
    return launchGameMode(payload.modeId || 'cloud_multiplayer', {
      roomId: payload.roomId,
      gameMode: payload.gameMode || modeValue,
    });
  }, []);

  const createRoom = useCallback(async () => sessionRef.current?.createPrivateRoom?.(), []);
  const joinRoom = useCallback(async (code: string) => sessionRef.current?.joinPrivateRoom?.(String(code || '').trim()), []);
  const leaveRoom = useCallback(async () => {
    const runtimeSession = getRuntimeSession();
    if (sessionState.activityState === 'paused' || sessionState.activityState === 'in_match' || sessionState.awaitingInputCapture) {
      return runtimeSession?.returnToMenu?.();
    }
    return sessionRef.current?.runPartyAction?.('leave', {}, 'Leaving room...');
  }, [sessionState]);
  const setMode = useCallback(async (nextMode: RoomMode) => sessionRef.current?.setPrivateRoomMode?.(nextMode), []);
  const setTeamCount = useCallback(async (count: number) => sessionRef.current?.setPrivateRoomTeamCount?.(count), []);
  const toggleLock = useCallback(async () => sessionRef.current?.setPrivateRoomInviteLock?.(!isLocked), [isLocked]);
  const inviteParty = useCallback(async () => sessionRef.current?.invitePartyToPrivateRoom?.(), []);
  const invitePlayer = useCallback(async (name: string) => sessionRef.current?.runPartyAction?.('invite', { targetId: String(name || '').trim() }, 'Sending invite...'), []);
  const selectPlayer = useCallback((player: RoomPlayer | null) => setSelectedPlayer(player), []);
  const assignToTeam = useCallback(async (teamIdx: number) => {
    if (!selectedPlayer) return null;
    const targetTeamId = teamIds[teamIdx];
    if (!targetTeamId) return null;
    setSelectedPlayer(null);
    return sessionRef.current?.movePrivateRoomMember?.(selectedPlayer.id, targetTeamId);
  }, [selectedPlayer, teamIds]);
  const movePlayer = useCallback(async (playerId: string, _fromTeam: number, toTeam: number) => {
    const targetTeamId = teamIds[toTeam];
    if (!targetTeamId) return null;
    return sessionRef.current?.movePrivateRoomMember?.(playerId, targetTeamId);
  }, [teamIds]);
  const randomizeTeams = useCallback(async () => sessionRef.current?.randomizePrivateRoomTeams?.(), []);
  const startMatch = useCallback(async () => {
    startCountdown();
    return sessionRef.current?.startPrivateRoomMatch?.();
  }, [startCountdown]);
  const toggleReady = useCallback((playerId: string) => {
    setReadyPlayers((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);
  const acceptInvite = useCallback(async (_roomCode: string) => sessionRef.current?.runPartyAction?.('accept_room_invite', {}, 'Joining room invite...'), []);
  const dismissInvite = useCallback(async (_roomCode: string) => sessionRef.current?.runPartyAction?.('dismiss_room_invite', {}, 'Dismissing room invite...'), []);
  const addMockInvite = useCallback(() => undefined, []);
  const togglePause = useCallback(async () => {
    const runtimeSession = getRuntimeSession();
    if (isPaused) return runtimeSession?.resumeGameplay?.();
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    return null;
  }, [isPaused]);
  const kickPlayer = useCallback(async (playerId: string) => sessionRef.current?.runPartyAction?.('kick', { targetId: playerId }, 'Removing player...'), []);
  const startPartyMatch = useCallback(async () => sessionRef.current?.startPrivateRoomMatch?.(), []);
  const endMatch = useCallback(() => undefined, []);
  const returnToLobby = useCallback(async () => getRuntimeSession()?.completePostGameFlow?.(), []);
  const returnToMenu = useCallback(async () => {
    const runtimeSession = getRuntimeSession();
    if (runtimeSession?.returnToMenu) return runtimeSession.returnToMenu();
    window.location.href = window.location.pathname;
  }, []);
  const inviteFriendById = useCallback(async (targetId: string) => sessionRef.current?.runPartyAction?.('invite', { targetId }, 'Sending invite...'), []);
  const joinFriendById = useCallback(async (targetId: string) => sessionRef.current?.runPartyAction?.('join', { targetId }, 'Joining friend...'), []);
  const addFriend = useCallback(async (targetId: string) => sessionRef.current?.performFriendAction?.('add', targetId, 'Saving friend...', 'Friend saved.'), []);
  const removeFriend = useCallback(async (targetId: string) => sessionRef.current?.performFriendAction?.('remove', targetId, 'Removing friend...', 'Friend removed.'), []);
  const inviteFriend = useCallback(async (targetId: string) => sessionRef.current?.performFriendAction?.('invite', targetId, 'Sending invite...', 'Invite sent.'), []);
  const joinFriend = useCallback(async (targetId: string) => sessionRef.current?.performFriendAction?.('join', targetId, 'Joining friend...', 'Joined friend.'), []);
  const leaveParty = useCallback(async () => sessionRef.current?.runPartyAction?.('leave', {}, 'Leaving party...'), []);
  const acceptPartyInvite = useCallback(async (targetId: string) => sessionRef.current?.runPartyAction?.('accept_invite', { targetId }, 'Joining invite...'), []);
  const dismissPartyInvite = useCallback(async (targetId: string) => sessionRef.current?.runPartyAction?.('dismiss_invite', { targetId }, 'Dismissing invite...'), []);
  const enterGameplay = useCallback(async (event?: Event | React.SyntheticEvent | null) => {
    const runtimeSession = getRuntimeSession();
    if (runtimeSession?.startGameplayFromMenu) return runtimeSession.startGameplayFromMenu(event || null);
    if (runtimeSession?.enterGameplay) return runtimeSession.enterGameplay(event || null, sessionState.launchContext || {});
    return null;
  }, [sessionState]);

  const value = useMemo<RoomState>(() => ({
    isInRoom,
    roomCode,
    mode,
    teamCount,
    isLocked,
    isCreator,
    players,
    teams,
    selectedPlayer,
    pendingInvites,
    matchState,
    countdownValue,
    readyPlayers,
    disconnectedPlayers: new Map(),
    isPaused,
    matchStats,
    matchResult,
    friends,
    partyMembers,
    isPartyLeader,
    awaitingInputCapture: !!sessionState.awaitingInputCapture,
    busyMessage,
    partyStatusText: partyStatus.text,
    friendsStatusText: friendsStatus.text,
    roomStatusText: roomStatus.text,
    createRoom,
    joinRoom,
    leaveRoom,
    setMode,
    setTeamCount,
    toggleLock,
    inviteParty,
    invitePlayer,
    selectPlayer,
    assignToTeam,
    movePlayer,
    randomizeTeams,
    startMatch,
    toggleReady,
    acceptInvite,
    dismissInvite,
    addMockInvite,
    togglePause,
    kickPlayer,
    startPartyMatch,
    endMatch,
    returnToLobby,
    returnToMenu,
    launchQuickPlay,
    inviteFriendById,
    joinFriendById,
    addFriend,
    removeFriend,
    inviteFriend,
    joinFriend,
    leaveParty,
    acceptPartyInvite,
    dismissPartyInvite,
    enterGameplay,
  }), [
    isInRoom,
    roomCode,
    mode,
    teamCount,
    isLocked,
    isCreator,
    players,
    teams,
    selectedPlayer,
    pendingInvites,
    matchState,
    countdownValue,
    readyPlayers,
    isPaused,
    matchStats,
    matchResult,
    friends,
    partyMembers,
    isPartyLeader,
    sessionState,
    busyMessage,
    partyStatus,
    friendsStatus,
    roomStatus,
    createRoom,
    joinRoom,
    leaveRoom,
    setMode,
    setTeamCount,
    toggleLock,
    inviteParty,
    invitePlayer,
    selectPlayer,
    assignToTeam,
    movePlayer,
    randomizeTeams,
    startMatch,
    toggleReady,
    acceptInvite,
    dismissInvite,
    addMockInvite,
    togglePause,
    kickPlayer,
    startPartyMatch,
    endMatch,
    returnToLobby,
    returnToMenu,
    launchQuickPlay,
    inviteFriendById,
    joinFriendById,
    addFriend,
    removeFriend,
    inviteFriend,
    joinFriend,
    leaveParty,
    acceptPartyInvite,
    dismissPartyInvite,
    enterGameplay,
  ]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
};

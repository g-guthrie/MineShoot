import React, { useEffect, useMemo, useState } from 'react';
import {
  Crosshair, ChevronDown, Swords, Target, Dumbbell,
  UserPlus, ArrowRight, Users, UserMinus,
  Copy, Lock, Unlock, Shuffle, Play, GripVertical,
  DoorOpen, LogOut, Check, Shield,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRoom, MAX_PLAYERS, type RoomPlayer } from '@/hooks/useRoom';
import { toast } from '@/hooks/use-toast';

interface GameMode { id: string; label: string; icon: React.ReactNode }
const GAME_MODES: GameMode[] = [
  { id: 'ffa', label: 'FREE FOR ALL', icon: <Crosshair className="w-3.5 h-3.5" /> },
  { id: 'tdm', label: 'TEAM DEATHMATCH', icon: <Swords className="w-3.5 h-3.5" /> },
  { id: 'lms', label: 'LAST MAN STANDING', icon: <Target className="w-3.5 h-3.5" /> },
  { id: 'practice', label: 'PRACTICE', icon: <Dumbbell className="w-3.5 h-3.5" /> },
];

const ROOM_MODES = [
  { id: 'ffa' as const, label: 'FFA', icon: <Crosshair className="w-3 h-3" /> },
  { id: 'tdm' as const, label: 'TDM', icon: <Swords className="w-3 h-3" /> },
  { id: 'lms' as const, label: 'LMS', icon: <Target className="w-3 h-3" /> },
];
const TEAM_COUNTS = [2, 3, 4];

const TEAM_COLORS = ['text-cyan-400', 'text-rose-400', 'text-amber-400', 'text-emerald-400'];
const TEAM_BORDER_COLORS = ['border-cyan-400/30', 'border-rose-400/30', 'border-amber-400/30', 'border-emerald-400/30'];
const TEAM_BG_COLORS = ['bg-cyan-400/5', 'bg-rose-400/5', 'bg-amber-400/5', 'bg-emerald-400/5'];

const HomeScreen: React.FC = () => {
  const { isLoggedIn, displayName, actorId } = useAuth();
  const room = useRoom();
  const [selectedMode, setSelectedMode] = useState(() => {
    try {
      const stored = window.sessionStorage.getItem('mayhem.menu.selectedMode');
      return stored && GAME_MODES.some((mode) => mode.id === stored) ? stored : 'ffa';
    } catch {
      return 'ffa';
    }
  });
  const [modesOpen, setModesOpen] = useState(false);
  const [friendId, setFriendId] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [addFriendId, setAddFriendId] = useState('');
  const [removeMode, setRemoveMode] = useState(false);
  const [confirmingFriend, setConfirmingFriend] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState('');

  const availableModes = room.isInRoom ? GAME_MODES.filter((mode) => mode.id !== 'practice') : GAME_MODES;
  const currentMode = availableModes.find((mode) => mode.id === selectedMode) || availableModes[0] || GAME_MODES[0];
  const showSocialPanel = isLoggedIn || room.partyMembers.length > 1 || room.friends.length > 0;

  const privateRoomPlayers = useMemo(() => room.players, [room.players]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem('mayhem.menu.selectedMode', selectedMode);
    } catch {
      // no-op
    }
  }, [selectedMode]);

  const syncSelectedRoomMode = async () => {
    if (!room.isCreator) return;
    const nextMode = selectedMode === 'tdm' || selectedMode === 'lms' ? selectedMode : 'ffa';
    if (room.mode === nextMode) return;
    await room.setMode(nextMode);
  };

  const handleQuickPlay = async () => {
    try {
      const result = await room.launchQuickPlay(selectedMode);
      if (result && result.ok === false) {
        toast({ title: 'Launch failed', description: result.error || 'Could not launch match.', variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: 'Launch failed',
        description: error instanceof Error ? error.message : 'Could not launch match.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateRoom = async () => {
    await room.createRoom(displayName, actorId);
    if (selectedMode === 'tdm' || selectedMode === 'lms') {
      await room.setMode(selectedMode);
    }
  };

  const handleRoomPrimaryAction = async () => {
    if (room.isCreator) {
      await syncSelectedRoomMode();
      await room.startMatch();
      return;
    }
    room.toggleReady(actorId);
  };

  const handlePlayerClick = (player: RoomPlayer) => {
    room.selectPlayer(room.selectedPlayer?.id === player.id ? null : player);
  };

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      toast({ title: 'Copied room code', description: room.roomCode });
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard not available.', variant: 'destructive' });
    }
  };

  const handleAddFriend = async () => {
    if (!addFriendId.trim()) return;
    await room.addFriend(addFriendId.trim());
    setAddFriendId('');
    setAddFriendOpen(false);
  };

  const handleRemoveFriend = async (userId: string) => {
    const nextCount = room.friends.filter((friend) => friend.userId !== userId).length;
    await room.removeFriend(userId);
    setConfirmingFriend(null);
    if (nextCount === 0) setRemoveMode(false);
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {room.pendingInvites.length > 0 && (
        <div className="glass-card p-3 flex flex-col gap-2">
          {room.pendingInvites.map((invite) => (
            <div key={invite.roomCode} className="flex items-center justify-between gap-2 rounded-xl bg-muted/20 px-3 py-2">
              <div>
                <div className="font-rajdhani font-semibold text-sm text-foreground">{invite.from}</div>
                <div className="font-orbitron text-[9px] tracking-wider text-muted-foreground">ROOM {invite.roomCode}</div>
              </div>
              <div className="flex gap-2">
                <button className="pill-btn active !rounded-xl !px-3 !py-1.5 !text-[9px]" onClick={() => room.acceptInvite(invite.roomCode)}>ACCEPT</button>
                <button className="pill-btn !rounded-xl !px-3 !py-1.5 !text-[9px]" onClick={() => room.dismissInvite(invite.roomCode)}>DISMISS</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`grid gap-3 ${room.isInRoom ? 'grid-cols-1 sm:grid-cols-[minmax(250px,1fr)_2fr]' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {room.isInRoom ? (
          <>
            <div className="flex flex-col justify-between h-full gap-3">
              <div id="menu-home-hero" className="glass-card p-3 flex flex-col gap-2">
                <span className="section-label !mb-0">GAME MODE</span>
                <div id="play-mode-toolbar" className="flex items-center gap-2">
                  <button id="primary-launch-btn" className="launch-btn flex-1 !py-2 !text-[10px] animate-pulse-glow" onClick={handleRoomPrimaryAction}>
                    <Play className="w-3.5 h-3.5" /> {room.isCreator ? 'START MATCH' : (room.readyPlayers.has(actorId) ? 'UNREADY' : 'READY UP')}
                  </button>
                  <button id="game-modes-toggle-btn" className={`pill-btn !px-2 !py-2 gap-1.5 min-w-0 transition-transform ${modesOpen ? 'active' : ''}`} onClick={() => setModesOpen(!modesOpen)}>
                    {currentMode.icon}
                    <span className="font-orbitron text-[9px] font-bold tracking-wider truncate max-w-[100px]">{currentMode.label}</span>
                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${modesOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {modesOpen && (
                  <div id="play-mode-options" className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
                    {availableModes.map((mode) => (
                      <button key={mode.id} className={`item-grid-btn !p-2 text-left !min-h-0 ${selectedMode === mode.id ? 'selected' : ''}`} onClick={() => { setSelectedMode(mode.id); setModesOpen(false); }}>
                        <div className="flex items-center gap-1.5 w-full">
                          <span className={selectedMode === mode.id ? 'text-primary' : ''}>{mode.icon}</span>
                          <span className="font-orbitron text-[9px] font-bold tracking-wider">{mode.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-3 flex flex-col gap-2">
                <span className="section-label !mb-0">QUICK JOIN</span>
                <div className="flex gap-1.5">
                  <input className="glass-input flex-1 !py-1.5 !px-2.5 !text-xs" placeholder="Enter Friend ID" value={friendId} onChange={(event) => setFriendId(event.target.value)} />
                  <button className="pill-btn active !rounded-xl !px-3" onClick={() => room.inviteFriendById(friendId.trim())} disabled={!friendId.trim()}><UserPlus className="w-3.5 h-3.5" /></button>
                  <button className="pill-btn !rounded-xl !px-3" onClick={() => room.joinFriendById(friendId.trim())} disabled={!friendId.trim()}><ArrowRight className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex gap-1.5">
                  <input className="glass-input flex-1 !py-1.5 !px-2.5 !text-xs" placeholder="Enter Room Code" value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())} />
                  <button className="pill-btn !rounded-xl !px-3 !text-[9px]" onClick={() => room.joinRoom(roomCodeInput.trim(), displayName, actorId)} disabled={roomCodeInput.trim().length < 4}>JOIN ROOM</button>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="section-label !mb-1">ROOM</div>
                  <h2 className="font-orbitron text-lg font-bold text-foreground">Private Room</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span id="room-share-code" className="font-orbitron text-xs font-bold text-primary tracking-wider">{room.roomCode}</span>
                  <button id="copy-room-code-btn" className="pill-btn !rounded-lg !px-2 !py-1.5" onClick={handleCopyRoomCode}><Copy className="w-3 h-3" /></button>
                  <button className="pill-btn !px-1.5 !py-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={room.leaveRoom} title="Leave Room"><LogOut className="w-3 h-3" /></button>
                </div>
              </div>

              {room.roomStatusText && <div className="text-xs font-rajdhani text-muted-foreground">{room.roomStatusText}</div>}

              {room.isCreator && (
                <>
                  <div className="flex gap-2">
                    {ROOM_MODES.map((mode) => (
                      <button key={mode.id} className={`pill-btn flex-1 justify-center gap-1 !text-[9px] !px-2 !py-1.5 ${room.mode === mode.id ? 'active' : ''}`} onClick={() => room.setMode(mode.id)}>
                        {mode.icon} {mode.label}
                      </button>
                    ))}
                  </div>
                  {room.mode !== 'ffa' && (
                    <div className="flex gap-2">
                      {TEAM_COUNTS.map((count) => (
                        <button key={count} className={`pill-btn flex-1 justify-center !text-[9px] !px-2 !py-1.5 ${room.teamCount === count ? 'active' : ''}`} onClick={() => room.setTeamCount(count)}>
                          {count} TEAMS
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button className={`pill-btn flex-1 justify-center gap-1 !text-[9px] !px-2 !py-1.5 ${room.isLocked ? 'active' : ''}`} onClick={room.toggleLock}>
                      {room.isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />} {room.isLocked ? 'LOCKED' : 'OPEN'}
                    </button>
                    {room.mode !== 'ffa' && (
                      <button className="pill-btn flex-1 justify-center gap-1 !text-[9px] !px-2 !py-1.5" onClick={room.randomizeTeams}>
                        <Shuffle className="w-2.5 h-2.5" /> RANDOMIZE
                      </button>
                    )}
                  </div>
                </>
              )}

              {room.selectedPlayer && (
                <div className="text-[9px] font-orbitron tracking-wider text-primary text-center">
                  TAP A TEAM TO ASSIGN {room.selectedPlayer.name.toUpperCase()}
                </div>
              )}

              {room.mode !== 'ffa' ? (
                <div className={`grid gap-2 max-h-[200px] overflow-y-auto ${room.teamCount <= 2 ? 'grid-cols-2' : room.teamCount === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                  {Array.from({ length: room.teamCount }).map((_, teamIndex) => (
                    <div key={teamIndex} className={`rounded-xl border p-2 min-h-[100px] transition-all ${room.selectedPlayer ? `${TEAM_BORDER_COLORS[teamIndex]} ${TEAM_BG_COLORS[teamIndex]} hover:scale-[1.01]` : 'border-border/50 bg-muted/10 hover:bg-muted/20'}`} onClick={() => room.assignToTeam(teamIndex)}>
                      <span className={`font-orbitron text-[8px] font-bold tracking-wider mb-1.5 block ${TEAM_COLORS[teamIndex]}`}>TEAM {teamIndex + 1}</span>
                      <div className="flex flex-col gap-0.5">
                        {(room.teams[teamIndex] || []).map((member) => (
                          <div key={member.id} className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-all group ${room.selectedPlayer?.id === member.id ? 'bg-primary/20 border border-primary/40 ring-1 ring-primary/20' : 'bg-muted/20 cursor-grab active:cursor-grabbing hover:bg-primary/10 border border-transparent'}`} onClick={(event) => { event.stopPropagation(); handlePlayerClick(member); }}>
                            <GripVertical className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
                            <span className="font-rajdhani font-semibold text-[10px] text-foreground flex-1">{member.name}</span>
                            {member.isCreator && <Shield className="w-2 h-2 text-primary" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="min-h-0">
                  <span className="section-label flex items-center gap-1 !mb-1.5"><Users className="w-3 h-3 text-primary" /> PLAYERS ({privateRoomPlayers.length}/{MAX_PLAYERS})</span>
                  <div className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
                    {privateRoomPlayers.map((player) => (
                      <div key={player.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/20">
                        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="font-rajdhani font-semibold text-xs text-foreground">{player.name}</span></div>
                        {player.isCreator && <Shield className="w-2.5 h-2.5 text-primary" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!room.isLocked || room.isCreator) && (
                <div className="flex gap-1.5">
                  <input className="glass-input flex-1 !py-1.5 !px-2.5 !text-xs" placeholder="Player ID..." value={inviteInput} onChange={(event) => setInviteInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && inviteInput.trim() && room.invitePlayer(inviteInput.trim()).then(() => setInviteInput(''))} />
                  <button className="pill-btn !px-2 !py-1.5 !text-[9px] gap-1" onClick={() => inviteInput.trim() && room.invitePlayer(inviteInput.trim()).then(() => setInviteInput(''))}><UserPlus className="w-2.5 h-2.5" /> INVITE</button>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {room.isCreator && (
                  <button className="pill-btn flex-1 justify-center !py-2 !text-[9px] gap-1" onClick={room.inviteParty}><Users className="w-3 h-3" /> INVITE PARTY</button>
                )}
                <button className="launch-btn flex-1 !py-2 !text-[9px] gap-1" onClick={() => {
                  if (room.isCreator) {
                    syncSelectedRoomMode().then(() => room.startMatch());
                    return;
                  }
                  room.toggleReady(actorId);
                }}>
                  <Play className="w-3 h-3" /> {room.isCreator ? 'START PRIVATE MATCH' : (room.readyPlayers.has(actorId) ? 'UNREADY' : 'READY UP')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div id="menu-home-hero" className="glass-card p-3 flex flex-col gap-2">
              <span className="section-label !mb-0">GAME MODE</span>
              <div id="play-mode-toolbar" className="flex items-center gap-2">
                <button id="primary-launch-btn" className="launch-btn flex-1 !py-2 !text-[10px] animate-pulse-glow" onClick={handleQuickPlay}>
                  <Play className="w-3.5 h-3.5" /> START MATCH
                </button>
                <button id="game-modes-toggle-btn" className={`pill-btn !px-2 !py-2 gap-1.5 min-w-0 transition-transform ${modesOpen ? 'active' : ''}`} onClick={() => setModesOpen(!modesOpen)}>
                  {currentMode.icon}
                  <span className="font-orbitron text-[9px] font-bold tracking-wider truncate max-w-[100px]">{currentMode.label}</span>
                  <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${modesOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {modesOpen && (
                <div id="play-mode-options" className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
                  {GAME_MODES.map((mode) => (
                    <button key={mode.id} id={mode.id === 'practice' ? 'practice-mode-btn' : `play-mode-${mode.id}-btn`} className={`item-grid-btn !p-2 text-left !min-h-0 ${selectedMode === mode.id ? 'selected' : ''}`} onClick={() => { setSelectedMode(mode.id); setModesOpen(false); }}>
                      <div className="flex items-center gap-1.5 w-full"><span className={selectedMode === mode.id ? 'text-primary' : ''}>{mode.icon}</span><span className="font-orbitron text-[9px] font-bold tracking-wider">{mode.label}</span></div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card p-3 flex flex-col gap-2">
              <span className="section-label !mb-0">QUICK JOIN</span>
              <div className="flex gap-1.5">
                <input id="party-id-input" className="glass-input flex-1 !py-1.5 !px-2.5 !text-xs" placeholder="Enter Friend ID" value={friendId} onChange={(event) => setFriendId(event.target.value)} />
                <button id="invite-friend-btn" className="pill-btn active !rounded-xl !px-3" onClick={() => room.inviteFriendById(friendId.trim())} disabled={!friendId.trim()}><UserPlus className="w-3.5 h-3.5" /></button>
                <button id="join-friend-btn" className="pill-btn !rounded-xl !px-3" onClick={() => room.joinFriendById(friendId.trim())} disabled={!friendId.trim()}><ArrowRight className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex gap-1.5">
                <input id="room-code-input" className="glass-input flex-1 !py-1.5 !px-2.5 !text-xs" placeholder="Enter Room Code" value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())} />
                <button id="join-room-btn" className="pill-btn !rounded-xl !px-3 !text-[9px]" onClick={() => room.joinRoom(roomCodeInput.trim(), displayName, actorId)} disabled={roomCodeInput.trim().length < 4}>JOIN ROOM</button>
              </div>
            </div>

            <div className="glass-card p-3 flex flex-col items-center justify-center gap-2">
              <button className="launch-btn w-full !py-2.5 !text-[10px] gap-1.5" onClick={handleCreateRoom}>
                <DoorOpen className="w-3.5 h-3.5" /> CREATE ROOM
              </button>
            </div>
          </>
        )}
      </div>

      {showSocialPanel && (
        <div className="grid grid-cols-1 gap-3 flex-1 min-h-0">
          <div className="glass-card p-3 sm:p-4 flex flex-col gap-2.5 overflow-y-auto min-h-0">
            {room.partyMembers.length > 1 && (
              <div id="menu-party-hero">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="section-label flex items-center gap-1 !mb-0"><Users className="w-3 h-3 text-primary" /> YOUR PARTY</span>
                  <button id="party-hero-leave-btn" className="pill-btn !px-1.5 !py-0.5 text-[8px] gap-0.5" onClick={() => room.leaveParty()}>
                    <LogOut className="w-2.5 h-2.5" /> <span className="hidden sm:inline">LEAVE</span>
                  </button>
                </div>
                <div id="party-hero-members" className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
                  {room.partyMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="font-rajdhani font-semibold text-xs text-foreground">{member.name}</span>
                        {member.isLeader && <span className="text-[8px] font-orbitron text-primary tracking-wider">LEADER</span>}
                      </div>
                      {room.isPartyLeader && !member.isLeader && (
                        <button className="pill-btn !px-1.5 !py-0.5 text-[8px]" onClick={() => room.kickPlayer(member.id)} title="Remove from party">
                          <UserMinus className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoggedIn && (
              <div id="menu-social-friends-pane" className="flex-1 min-h-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="section-label flex items-center gap-1 !mb-0"><Users className="w-3 h-3 text-primary" /> FRIENDS</span>
                  <div className="flex items-center gap-1">
                    <button className="pill-btn !px-1.5 !py-0.5 text-[8px] gap-0.5" onClick={() => setAddFriendOpen(!addFriendOpen)}><UserPlus className="w-2.5 h-2.5" /><span className="hidden sm:inline">ADD</span></button>
                    <button className={`pill-btn !px-1.5 !py-0.5 text-[8px] gap-0.5 ${removeMode ? 'active' : ''}`} onClick={() => { setRemoveMode(!removeMode); setConfirmingFriend(null); }}><UserMinus className="w-2.5 h-2.5" /><span className="hidden sm:inline">REMOVE</span></button>
                  </div>
                </div>

                {addFriendOpen && (
                  <div className="flex gap-1.5 mb-1.5 animate-fade-in-up" style={{ animationDuration: '0.15s' }}>
                    <input className="glass-input flex-1 !py-1 !px-2 !text-xs" placeholder="Enter player ID..." value={addFriendId} onChange={(event) => setAddFriendId(event.target.value)} autoFocus />
                    <button className="pill-btn active !px-2 !py-1 !text-[9px]" onClick={handleAddFriend}>SEND</button>
                  </div>
                )}

                <div id="social-friends-list" className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto">
                  {room.friends.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground font-orbitron text-[9px] tracking-wider">NO FRIENDS YET — ADD SOMEONE!</div>
                  )}
                  {room.friends.map((friend) => (
                    <div key={friend.userId} className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${removeMode ? 'hover:bg-destructive/10 border border-transparent hover:border-destructive/20' : 'hover:bg-muted/30'} ${confirmingFriend === friend.userId ? 'bg-destructive/10 border border-destructive/20' : ''}`} onClick={() => removeMode && setConfirmingFriend(confirmingFriend === friend.userId ? null : friend.userId)}>
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${friend.status === 'online' ? 'bg-green-400' : friend.status === 'away' ? 'bg-yellow-500' : 'bg-muted-foreground/40'}`} />
                        <span className="font-rajdhani font-semibold text-xs text-foreground">{friend.name}</span>
                        {friend.inGame && <span className="text-[8px] font-orbitron text-primary tracking-wider ml-1">IN GAME</span>}
                      </div>
                      {confirmingFriend === friend.userId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-orbitron text-destructive tracking-wider">REMOVE?</span>
                          <button className="pill-btn !px-1.5 !py-0.5 text-[8px] text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/20" onClick={(event) => { event.stopPropagation(); handleRemoveFriend(friend.userId); }}>YES</button>
                          <button className="pill-btn !px-1.5 !py-0.5 text-[8px]" onClick={(event) => { event.stopPropagation(); setConfirmingFriend(null); }}>NO</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {friend.incomingInvite && <button className="pill-btn !px-1.5 !py-0.5 text-[8px]" onClick={() => room.acceptPartyInvite(friend.userId)}><Check className="w-2.5 h-2.5" /></button>}
                          {friend.canJoin && <button className="pill-btn !px-1.5 !py-0.5 text-[8px]" onClick={() => room.joinFriend(friend.userId)}>JOIN</button>}
                          {friend.canInvite && !friend.sameParty && <button className="pill-btn !px-1.5 !py-0.5 text-[8px]" onClick={() => room.inviteFriend(friend.userId)} disabled={friend.outgoingInvite}>{friend.outgoingInvite ? 'SENT' : 'INVITE'}</button>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeScreen;

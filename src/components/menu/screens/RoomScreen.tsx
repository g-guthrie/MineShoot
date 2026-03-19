import React, { useState, useCallback } from 'react';
import { Copy, Lock, Unlock, Shuffle, Play, Users, Swords, Crosshair, Target, GripVertical } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
}

const ROOM_MODES = [
  { id: 'ffa', label: 'FFA', icon: <Crosshair className="w-3.5 h-3.5" /> },
  { id: 'tdm', label: 'TDM', icon: <Swords className="w-3.5 h-3.5" /> },
  { id: 'lms', label: 'LMS', icon: <Target className="w-3.5 h-3.5" /> },
];

const TEAM_COUNTS = [2, 3, 4];

const RoomScreen: React.FC = () => {
  const [roomCode] = useState('7F3A');
  const [roomMode, setRoomMode] = useState('ffa');
  const [teamCount, setTeamCount] = useState(2);
  const [isLocked, setIsLocked] = useState(false);
  const [teams, setTeams] = useState<Record<number, TeamMember[]>>({
    0: [{ id: '1', name: 'You' }, { id: '2', name: 'xVortex' }],
    1: [{ id: '3', name: 'NightOwl' }, { id: '4', name: 'BlazeFury' }],
  });
  const [dragItem, setDragItem] = useState<{ teamIdx: number; memberIdx: number } | null>(null);

  const handleDragStart = (teamIdx: number, memberIdx: number) => {
    setDragItem({ teamIdx, memberIdx });
  };

  const handleDrop = useCallback((targetTeamIdx: number) => {
    if (!dragItem) return;
    const { teamIdx: srcTeam, memberIdx: srcIdx } = dragItem;
    if (srcTeam === targetTeamIdx) return;

    setTeams(prev => {
      const next = { ...prev };
      const srcMembers = [...(next[srcTeam] || [])];
      const targetMembers = [...(next[targetTeamIdx] || [])];
      const [moved] = srcMembers.splice(srcIdx, 1);
      targetMembers.push(moved);
      next[srcTeam] = srcMembers;
      next[targetTeamIdx] = targetMembers;
      return next;
    });
    setDragItem(null);
  }, [dragItem]);

  const randomizeTeams = () => {
    const allMembers = Object.values(teams).flat();
    const shuffled = [...allMembers].sort(() => Math.random() - 0.5);
    const newTeams: Record<number, TeamMember[]> = {};
    for (let i = 0; i < teamCount; i++) newTeams[i] = [];
    shuffled.forEach((m, i) => newTeams[i % teamCount].push(m));
    setTeams(newTeams);
  };

  return (
    <div id="menu-screen-room" className="flex flex-col gap-4 h-full">
      {/* Room Header */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="section-label !mb-0">PRIVATE ROOM</span>
          <div id="room-share-panel" className="flex items-center gap-2">
            <span id="room-share-code" className="font-orbitron text-sm font-bold text-primary tracking-wider">{roomCode}</span>
            <button id="copy-room-code-btn" className="pill-btn !rounded-lg !px-2 !py-1.5" title="Copy Room Code">
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div id="private-room-status" className="text-xs text-muted-foreground font-rajdhani" />
        <div id="room-social-feedback" className="text-xs font-rajdhani" />

        {/* Room invite banner */}
        <div id="room-social-invite-banner" className="hidden">
          <div id="room-social-invite-copy" />
          <div className="flex gap-2 mt-2">
            <button id="room-social-invite-accept-btn" className="pill-btn active !rounded-xl flex-1">ACCEPT</button>
            <button id="room-social-invite-dismiss-btn" className="pill-btn !rounded-xl flex-1">DISMISS</button>
          </div>
        </div>
      </div>

      {/* Room Config */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <span className="section-label">MODE</span>
        <div className="flex gap-2">
          {ROOM_MODES.map(mode => (
            <button
              key={mode.id}
              id={`private-room-mode-${mode.id}-btn`}
              className={`pill-btn !rounded-xl flex-1 justify-center gap-1.5 ${roomMode === mode.id ? 'active' : ''}`}
              onClick={() => setRoomMode(mode.id)}
            >
              {mode.icon}
              {mode.label}
            </button>
          ))}
        </div>

        {roomMode !== 'ffa' && (
          <>
            <span className="section-label">TEAMS</span>
            <div className="flex gap-2">
              {TEAM_COUNTS.map(n => (
                <button
                  key={n}
                  className={`pill-btn !rounded-xl flex-1 justify-center ${teamCount === n ? 'active' : ''}`}
                  onClick={() => setTeamCount(n)}
                >
                  {n} TEAMS
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            className={`pill-btn !rounded-xl flex-1 justify-center gap-1.5 ${isLocked ? 'active' : ''}`}
            onClick={() => setIsLocked(!isLocked)}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {isLocked ? 'LOCKED' : 'OPEN'}
          </button>
          <button className="pill-btn !rounded-xl flex-1 justify-center gap-1.5" onClick={randomizeTeams}>
            <Shuffle className="w-3 h-3" /> RANDOMIZE
          </button>
        </div>
      </div>

      {/* Teams - Drag & Drop */}
      {roomMode !== 'ffa' && (
        <div className="glass-card p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
          <span className="section-label flex items-center gap-1.5">
            <Users className="w-3 h-3 text-primary" /> TEAM ROSTER
          </span>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: teamCount }).map((_, tIdx) => (
              <div
                key={tIdx}
                className="rounded-xl border border-border/50 p-3 min-h-[80px] transition-colors bg-muted/10 hover:bg-muted/20"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(tIdx)}
              >
                <span className="font-orbitron text-[10px] font-bold text-primary tracking-wider mb-2 block">
                  TEAM {tIdx + 1}
                </span>
                <div className="flex flex-col gap-1">
                  {(teams[tIdx] || []).map((member, mIdx) => (
                    <div
                      key={member.id}
                      draggable
                      onDragStart={() => handleDragStart(tIdx, mIdx)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/20 cursor-grab active:cursor-grabbing hover:bg-primary/10 transition-colors group"
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-rajdhani font-semibold text-xs text-foreground">{member.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room Actions */}
      <div className="flex gap-3">
        <button className="pill-btn !rounded-xl flex-1 justify-center !py-3">
          <Users className="w-3.5 h-3.5" /> INVITE PARTY
        </button>
        <button className="launch-btn flex-1 gap-2">
          <Play className="w-4 h-4" /> START MATCH
        </button>
      </div>
    </div>
  );
};

export default RoomScreen;

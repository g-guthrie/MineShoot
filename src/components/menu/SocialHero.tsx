import React, { useState } from 'react';
import { UserPlus, ArrowRight, Users, Hash, Globe, UserMinus } from 'lucide-react';

interface FakeFriend {
  name: string;
  status: 'online' | 'away';
  inGame: boolean;
}

const INITIAL_FRIENDS: FakeFriend[] = [
  { name: 'xVortex', status: 'online', inGame: true },
  { name: 'NightOwl', status: 'online', inGame: false },
  { name: 'BlazeFury', status: 'away', inGame: false },
];

const SocialHero: React.FC = () => {
  const [friendId, setFriendId] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [friends, setFriends] = useState<FakeFriend[]>(INITIAL_FRIENDS);
  const [removeMode, setRemoveMode] = useState(false);
  const [confirmingFriend, setConfirmingFriend] = useState<string | null>(null);

  const removeFriend = (name: string) => {
    setFriends(prev => prev.filter(f => f.name !== name));
    setConfirmingFriend(null);
    if (friends.length <= 1) setRemoveMode(false);
  };

  return (
    <div id="menu-social-hero" className="glass-card p-6 flex flex-col gap-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
      {/* Invite banner (hidden by default) */}
      <div id="social-direct-invite-banner" className="hidden">
        <div id="social-direct-invite-copy" />
        <div id="social-direct-invite-actions" className="flex gap-2">
          <button id="social-direct-invite-accept-btn" className="pill-btn active">Accept</button>
          <button id="social-direct-invite-dismiss-btn" className="pill-btn">Dismiss</button>
        </div>
      </div>

      <div id="menu-social-layout" className="flex flex-col gap-4">
        <div id="menu-social-actions-pane" className="flex flex-col gap-3">
          {/* Friend ID */}
          <div id="social-friend-id-stack" className="flex gap-2">
            <input
              id="party-id-input"
              className="glass-input flex-1"
              placeholder="Friend ID"
              value={friendId}
              onChange={e => setFriendId(e.target.value)}
            />
            <button id="invite-friend-btn" className="pill-btn active !rounded-xl !px-3" title="Invite">
              <UserPlus className="w-4 h-4" />
            </button>
            <button id="join-friend-btn" className="pill-btn !rounded-xl !px-3" title="Join">
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              id="remove-friend-toggle-btn"
              className={`pill-btn !rounded-xl !px-3 gap-1.5 ${removeMode ? 'text-destructive border-destructive/50 bg-destructive/10' : 'text-destructive border-destructive/30 hover:bg-destructive/10'}`}
              title="Remove Friend"
              onClick={() => {
                setRemoveMode(!removeMode);
                setConfirmingFriend(null);
              }}
            >
              <UserMinus className="w-4 h-4" />
              <span className="text-[10px] font-orbitron">REMOVE</span>
            </button>
          </div>

          {/* Room code */}
          <div id="social-room-join-stack" className="flex gap-2">
            <input
              id="room-code-input"
              className="glass-input flex-1"
              placeholder="Room Code"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
            />
            <button id="join-room-btn" className="pill-btn !rounded-xl !px-3" title="Join Room">
              <Globe className="w-4 h-4" />
            </button>
          </div>

          <div id="social-hero-status" className="text-xs text-muted-foreground font-rajdhani" />
        </div>

        {/* Friends list */}
        <div id="menu-social-friends-pane">
          <span className="section-label flex items-center gap-1.5">
            <Users className="w-3 h-3" /> FRIENDS
          </span>
          <div id="social-friends-list" className="flex flex-col gap-1.5 mt-1">
            {friends.map(f => (
              <div
                key={f.name}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  removeMode ? 'hover:bg-destructive/10 border border-transparent hover:border-destructive/20' : 'hover:bg-muted/30'
                } ${confirmingFriend === f.name ? 'bg-destructive/10 border border-destructive/20' : ''}`}
                onClick={() => {
                  if (removeMode) {
                    setConfirmingFriend(confirmingFriend === f.name ? null : f.name);
                  }
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${f.status === 'online' ? 'bg-green-400' : 'bg-yellow-500'}`} />
                  <span className="font-rajdhani font-semibold text-sm text-foreground">{f.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {f.inGame && !confirmingFriend && (
                    <span className="text-[10px] font-orbitron text-primary tracking-wider">IN GAME</span>
                  )}
                  {confirmingFriend === f.name && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-orbitron text-destructive tracking-wider">REMOVE?</span>
                      <button
                        className="pill-btn !rounded-xl !px-3 !py-1 text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFriend(f.name);
                        }}
                      >
                        <span className="text-[10px] font-orbitron">YES</span>
                      </button>
                      <button
                        className="pill-btn !rounded-xl !px-3 !py-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingFriend(null);
                        }}
                      >
                        <span className="text-[10px] font-orbitron">NO</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialHero;

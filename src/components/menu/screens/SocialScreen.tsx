import React, { useState } from 'react';
import { UserPlus, ArrowRight, Users, UserMinus } from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { toast } from '@/hooks/use-toast';

const SocialScreen: React.FC = () => {
  const room = useRoom();
  const [friendId, setFriendId] = useState('');
  const [removeMode, setRemoveMode] = useState(false);
  const [confirmingFriend, setConfirmingFriend] = useState<string | null>(null);

  const removeFriend = async (userId: string) => {
    const nextCount = room.friends.filter((friend) => friend.userId !== userId).length;
    await room.removeFriend(userId);
    setConfirmingFriend(null);
    if (nextCount === 0) setRemoveMode(false);
    toast({ title: 'Friend removed' });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="glass-card p-4 flex flex-col gap-3">
        <span className="section-label">ADD / JOIN FRIEND</span>
        <div className="flex gap-2">
          <input
            className="glass-input flex-1 !py-2 !text-xs"
            placeholder="Enter Friend ID"
            value={friendId}
            onChange={(event) => setFriendId(event.target.value)}
          />
          <button className="pill-btn active !rounded-xl !px-3" title="Invite" onClick={() => friendId.trim() && room.inviteFriendById(friendId.trim())}>
            <UserPlus className="w-3.5 h-3.5" />
          </button>
          <button className="pill-btn !rounded-xl !px-3" title="Join" onClick={() => friendId.trim() && room.joinFriendById(friendId.trim())}>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            className={`pill-btn !rounded-xl !px-3 gap-1.5 ${removeMode ? 'text-destructive border-destructive/50 bg-destructive/10' : 'text-destructive border-destructive/30 hover:bg-destructive/10'}`}
            title="Remove Friend"
            onClick={() => {
              setRemoveMode(!removeMode);
              setConfirmingFriend(null);
            }}
          >
            <UserMinus className="w-3.5 h-3.5" />
            <span className="text-[10px] font-orbitron">REMOVE</span>
          </button>
        </div>
      </div>

      {room.partyMembers.length > 1 && (
        <div id="menu-party-hero" className="glass-card p-4 flex flex-col gap-3">
          <span className="section-label flex items-center gap-1.5">
            <Users className="w-3 h-3 text-primary" /> YOUR PARTY
          </span>
          <div id="party-hero-members" className="flex flex-col gap-1.5">
            {room.partyMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="font-rajdhani font-semibold text-sm text-foreground">{member.name}</span>
                  {member.isLeader && <span className="text-[9px] font-orbitron text-primary tracking-wider">LEADER</span>}
                </div>
                {!member.isLeader && room.isPartyLeader && (
                  <button className="pill-btn !rounded-lg !px-2 !py-1 text-[9px]" title="Remove" onClick={() => room.kickPlayer(member.id)}>
                    <UserMinus className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div id="menu-party-actions">
            <button id="party-hero-leave-btn" className="pill-btn !rounded-xl w-full justify-center !py-2.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => room.leaveParty()}>
              LEAVE PARTY
            </button>
          </div>
        </div>
      )}

      <div id="menu-social-friends-pane" className="glass-card p-4 flex flex-col gap-3 flex-1 min-h-0">
        <span className="section-label flex items-center gap-1.5">
          <Users className="w-3 h-3 text-primary" /> FRIENDS ONLINE
        </span>
        <div id="social-friends-list" className="flex flex-col gap-1 overflow-y-auto max-h-[280px]">
          {room.friends.length === 0 && (
            <div className="text-center py-4 text-muted-foreground font-orbitron text-[9px] tracking-wider">
              NO FRIENDS YET — ADD SOMEONE!
            </div>
          )}
          {room.friends.map((friend) => (
            <div
              key={friend.userId}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer group ${
                removeMode ? 'hover:bg-destructive/10 border border-transparent hover:border-destructive/20' : 'hover:bg-muted/30'
              } ${confirmingFriend === friend.userId ? 'bg-destructive/10 border border-destructive/20' : ''}`}
              onClick={() => {
                if (removeMode) {
                  setConfirmingFriend(confirmingFriend === friend.userId ? null : friend.userId);
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${friend.status === 'online' ? 'bg-green-400' : friend.status === 'away' ? 'bg-yellow-500' : 'bg-muted-foreground/40'}`} />
                <span className="font-rajdhani font-semibold text-sm text-foreground">{friend.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {friend.inGame && !confirmingFriend && (
                  <span className="text-[9px] font-orbitron text-primary tracking-wider">IN GAME</span>
                )}
                {confirmingFriend === friend.userId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-orbitron text-destructive tracking-wider">REMOVE?</span>
                    <button
                      className="pill-btn !rounded-xl !px-3 !py-1 text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/20"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFriend(friend.userId);
                      }}
                    >
                      <span className="text-[10px] font-orbitron">YES</span>
                    </button>
                    <button
                      className="pill-btn !rounded-xl !px-3 !py-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmingFriend(null);
                      }}
                    >
                      <span className="text-[10px] font-orbitron">NO</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {friend.canJoin && <button className="pill-btn !rounded-xl !px-3 !py-1 text-[9px]" onClick={() => room.joinFriend(friend.userId)}>JOIN</button>}
                    {friend.canInvite && !friend.sameParty && <button className="pill-btn !rounded-xl !px-3 !py-1 text-[9px]" onClick={() => room.inviteFriend(friend.userId)} disabled={friend.outgoingInvite}>{friend.outgoingInvite ? 'SENT' : 'INVITE'}</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SocialScreen;

import React from 'react';
import { Trophy, ArrowLeft, Home } from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { useMenuNav } from '@/hooks/useMenuNav';

const PostMatchScreen: React.FC = () => {
  const { matchStats, matchResult, returnToLobby, returnToMenu, isInRoom } = useRoom();
  const menuNav = useMenuNav();

  if (!matchResult) return null;

  const kdRatio = (matchStats.kills / Math.max(1, matchStats.deaths)).toFixed(2);

  const handleBackToLobby = () => {
    returnToLobby();
    if (isInRoom) {
      menuNav.push('room');
    }
  };

  const handleMainMenu = () => {
    returnToMenu();
    menuNav.reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
      <div className="glass-surface p-6 rounded-2xl max-w-md w-full mx-4 animate-fade-in-up" style={{ borderRadius: 'var(--radius-xl)' }}>

        {/* Header — Winner or Standard */}
        {matchResult.isWinner ? (
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-3" style={{ boxShadow: '0 0 40px hsl(var(--primary) / 0.4)' }}>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <h2
              className="font-orbitron text-3xl font-black text-primary tracking-wider"
              style={{ textShadow: '0 0 30px hsl(var(--primary) / 0.5)' }}
            >
              VICTORY
            </h2>
            <p className="font-rajdhani text-sm text-muted-foreground mt-1">#1 — First Place</p>
          </div>
        ) : (
          <div className="text-center mb-6">
            <h2 className="font-orbitron text-2xl font-bold text-foreground tracking-wider mb-1">MATCH COMPLETE</h2>
            <p className="font-rajdhani text-lg text-muted-foreground">
              #{matchResult.placement} <span className="text-xs">of {matchResult.totalPlayers}</span>
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'KILLS', value: matchStats.kills, color: 'text-primary' },
            { label: 'DEATHS', value: matchStats.deaths, color: 'text-destructive' },
            { label: 'K/D RATIO', value: kdRatio, color: 'text-accent-foreground' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card p-4 flex flex-col items-center justify-center gap-1 text-center">
              <span className={`font-orbitron text-2xl font-bold ${color}`}>{value}</span>
              <span className="font-rajdhani text-[9px] font-semibold text-muted-foreground tracking-wider uppercase">{label}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isInRoom && (
            <button
              className="pill-btn !rounded-xl flex-1 justify-center !py-2.5 gap-1.5"
              onClick={handleBackToLobby}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> BACK TO LOBBY
            </button>
          )}
          <button
            className={`pill-btn !rounded-xl flex-1 justify-center !py-2.5 gap-1.5 ${isInRoom ? 'text-muted-foreground border-border/30 hover:bg-muted/10' : ''}`}
            onClick={handleMainMenu}
          >
            <Home className="w-3.5 h-3.5" /> MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostMatchScreen;

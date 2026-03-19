import React, { useEffect } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { useMenuNav } from '@/hooks/useMenuNav';
import { Check, X, Loader2, Swords, Menu } from 'lucide-react';
import PauseMenu from './PauseMenu';
import PostMatchScreen from './PostMatchScreen';

const MatchOverlay: React.FC = () => {
  const { matchState, countdownValue, players, readyPlayers, isCreator, startMatch, toggleReady, leaveRoom, togglePause, isPaused, disconnectedPlayers } = useRoom();
  const { actorId } = useAuth();
  const menuNav = useMenuNav();

  // ESC key to toggle pause during match
  useEffect(() => {
    if (matchState !== 'in-match') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPaused) {
        togglePause();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [matchState, isPaused, togglePause]);

  if (matchState === 'idle') return null;

  // Post-match screen
  if (matchState === 'post-match') {
    return <PostMatchScreen />;
  }

  if (matchState === 'in-match') {
    const handleLeave = () => {
      leaveRoom();
      menuNav.reset();
    };

    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
          <div className="text-center animate-fade-in-up">
            <Swords className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="font-orbitron text-2xl font-bold text-foreground mb-2">MATCH IN PROGRESS</h2>
            <p className="font-rajdhani text-muted-foreground text-sm mb-6">Game is running...</p>
            <div className="flex gap-2 justify-center">
              <button
                className="pill-btn !rounded-xl !px-6 !py-2.5 gap-1.5"
                onClick={togglePause}
              >
                <Menu className="w-3.5 h-3.5" /> MENU
              </button>
              <button
                className="pill-btn !rounded-xl !px-6 !py-2.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleLeave}
              >
                LEAVE MATCH
              </button>
            </div>
          </div>
        </div>
        <PauseMenu />
      </>
    );
  }

  if (matchState === 'countdown') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
        <div className="text-center">
          <div className="font-orbitron text-8xl font-black text-primary animate-pulse-glow" style={{ textShadow: '0 0 60px hsl(var(--primary) / 0.5)' }}>
            {countdownValue === 0 ? 'GO!' : countdownValue}
          </div>
          <p className="font-orbitron text-xs text-muted-foreground tracking-widest mt-4">MATCH STARTING</p>
        </div>
      </div>
    );
  }

  // ready-check
  const allReady = players.every(p => p.isCreator || readyPlayers.has(p.id));
  const selfReady = readyPlayers.has(actorId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-surface p-6 rounded-2xl max-w-sm w-full mx-4 animate-fade-in-up" style={{ borderRadius: 'var(--radius-xl)' }}>
        <h3 className="font-orbitron text-sm font-bold text-foreground text-center mb-4 tracking-wider">READY CHECK</h3>

        <div className="flex flex-col gap-1.5 mb-5">
          {players.map(p => {
            const ready = p.isCreator || readyPlayers.has(p.id);
            const isDisconnected = disconnectedPlayers.has(p.id);
            const dcInfo = disconnectedPlayers.get(p.id);
            return (
              <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                isDisconnected
                  ? 'bg-muted/10 border border-border/20 opacity-50'
                  : ready
                    ? 'bg-primary/10 border border-primary/20'
                    : 'bg-muted/20 border border-border/30'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`font-rajdhani font-semibold text-xs ${isDisconnected ? 'text-muted-foreground' : 'text-foreground'}`}>{p.name}</span>
                  {p.isCreator && <span className="font-orbitron text-[7px] text-primary tracking-wider">HOST</span>}
                  {isDisconnected && dcInfo && (
                    <span className="font-orbitron text-[7px] text-destructive tracking-wider">
                      DC {Math.ceil(dcInfo.remainingMs / 1000)}s
                    </span>
                  )}
                </div>
                {isDisconnected ? (
                  <X className="w-3.5 h-3.5 text-destructive/50" />
                ) : ready ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          {!isCreator && (
            <button
              className={`pill-btn !rounded-xl flex-1 justify-center !py-2.5 ${selfReady ? 'active' : ''}`}
              onClick={() => toggleReady(actorId)}
            >
              {selfReady ? 'READY ✓' : 'READY UP'}
            </button>
          )}
          {isCreator && (
            <button
              className={`launch-btn flex-1 !py-2.5 !text-[10px] !rounded-xl ${!allReady ? 'opacity-60' : ''}`}
              onClick={startMatch}
            >
              {allReady ? 'START NOW' : 'FORCE START'}
            </button>
          )}
          <button
            className="pill-btn !rounded-xl !px-3 !py-2.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => { leaveRoom(); menuNav.reset(); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchOverlay;

import React, { useState, useEffect } from 'react';
import { Play, Settings, LogOut, X, AlertTriangle, Send } from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { useMenuNav } from '@/hooks/useMenuNav';

const PauseMenu: React.FC = () => {
  const { togglePause, invitePlayer, leaveRoom, isPaused, matchStats } = useRoom();
  const menuNav = useMenuNav();
  const [view, setView] = useState<'main' | 'settings' | 'confirm-leave'>('main');
  const [inviteInput, setInviteInput] = useState('');

  // Reset view when pause menu opens
  useEffect(() => {
    if (isPaused) setView('main');
  }, [isPaused]);

  // ESC to close sub-views or resume — only when paused to avoid conflict with MatchOverlay
  useEffect(() => {
    if (!isPaused) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (view !== 'main') {
          setView('main');
        } else {
          togglePause();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPaused, view, togglePause]);

  if (!isPaused) return null;

  const handleInvite = () => {
    if (inviteInput.trim()) {
      invitePlayer(inviteInput.trim());
      setInviteInput('');
    }
  };

  const kdRatio = (matchStats.kills / Math.max(1, matchStats.deaths)).toFixed(2);

  /* ─── Settings sub-view ─── */
  if (view === 'settings') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-md">
        <div className="glass-surface p-5 rounded-2xl max-w-sm w-full mx-4 animate-fade-in-up" style={{ borderRadius: 'var(--radius-xl)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-orbitron text-xs font-bold text-foreground tracking-wider">SETTINGS</h3>
            <button className="pill-btn !rounded-lg !px-1.5 !py-1" onClick={() => setView('main')}>
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Master Volume', width: 'w-3/4' },
              { label: 'SFX Volume', width: 'w-1/2' },
              { label: 'Mouse Sensitivity', width: 'w-2/3' },
            ].map(({ label, width }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/20">
                <span className="font-rajdhani font-semibold text-xs text-foreground">{label}</span>
                <div className="w-20 h-1.5 rounded-full bg-muted/40 relative">
                  <div className={`absolute left-0 top-0 h-full ${width} rounded-full bg-primary`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Confirm leave sub-view ─── */
  if (view === 'confirm-leave') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-md">
        <div className="glass-surface p-5 rounded-2xl max-w-xs w-full mx-4 animate-fade-in-up" style={{ borderRadius: 'var(--radius-xl)' }}>
          <div className="flex flex-col items-center text-center gap-3">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <h3 className="font-orbitron text-xs font-bold text-foreground tracking-wider">LEAVE MATCH?</h3>
            <p className="font-rajdhani text-xs text-muted-foreground">You won't be able to rejoin this match.</p>
            <div className="flex gap-2 w-full mt-1">
              <button className="pill-btn !rounded-xl flex-1 justify-center !py-2.5 !text-[9px]" onClick={() => setView('main')}>
                CANCEL
              </button>
              <button
                className="pill-btn !rounded-xl flex-1 justify-center !py-2.5 !text-[9px] text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { leaveRoom(); menuNav.reset(); }}
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Main pause menu ─── */
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-md">
      <div className="glass-surface p-5 rounded-2xl max-w-md w-full mx-4 animate-fade-in-up" style={{ borderRadius: 'var(--radius-xl)' }}>

        {/* Header: PAUSED + inline invite */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <h3 className="font-orbitron text-sm font-bold text-foreground tracking-wider shrink-0">PAUSED</h3>
          <div className="flex gap-1.5 flex-1 max-w-[200px]">
            <input
              className="glass-input flex-1 !py-1.5 !px-2.5 !text-[10px] !rounded-lg"
              placeholder="Invite by name..."
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
            <button
              className="pill-btn active !rounded-lg !px-2 !py-1.5"
              onClick={handleInvite}
              disabled={!inviteInput.trim()}
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2 mb-5">
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

        {/* Action row */}
        <div className="grid grid-cols-3 gap-2">
          <button
            className="glass-card p-3 flex items-center justify-center gap-2 cursor-pointer group"
            onClick={togglePause}
          >
            <Play className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-orbitron text-[9px] font-bold tracking-wider text-foreground">RESUME</span>
          </button>
          <button
            className="glass-card p-3 flex items-center justify-center gap-2 cursor-pointer group"
            onClick={() => setView('settings')}
          >
            <Settings className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-orbitron text-[9px] font-bold tracking-wider text-foreground">SETTINGS</span>
          </button>
          <button
            className="glass-card p-3 flex items-center justify-center gap-2 cursor-pointer group border-destructive/10 hover:border-destructive/30"
            onClick={() => setView('confirm-leave')}
          >
            <LogOut className="w-3.5 h-3.5 text-destructive group-hover:scale-110 transition-transform" />
            <span className="font-orbitron text-[9px] font-bold tracking-wider text-destructive">LEAVE</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PauseMenu;

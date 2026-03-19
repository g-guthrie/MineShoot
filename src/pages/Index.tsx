import React from 'react';
import { MenuNavProvider } from '@/hooks/useMenuNav';
import { AuthProvider } from '@/hooks/useAuth';
import { RoomProvider, useRoom } from '@/hooks/useRoom';
import GameBridgeSync from '@/components/menu/GameBridgeSync';
import MenuHeader from '@/components/menu/MenuHeader';
import ScreenRouter from '@/components/menu/ScreenRouter';
import LoadoutBand from '@/components/menu/LoadoutBand';
import MatchOverlay from '@/components/menu/MatchOverlay';

const OverlayShell: React.FC = () => {
  const { matchState, isPaused } = useRoom();
  const passthrough = matchState === 'in-match' && !isPaused;

  return (
    <div
      id="overlay"
      className={`fixed inset-0 z-40 p-3 sm:p-5 ${passthrough ? 'pointer-events-none' : ''}`}
    >
      <div className="fixed inset-0 bg-background/45 backdrop-blur-[2px] pointer-events-none" />
      <GameBridgeSync />

      {matchState !== 'in-match' && (
        <div id="menu-stage" className="w-full h-full flex items-center justify-center relative z-10">
          <main
            id="menu-shell"
            className="menu-shell-v4 glass-surface w-full max-w-[960px] max-h-full flex flex-col overflow-hidden relative pointer-events-auto"
            style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lift)' }}
          >
            <div id="menu-surface" className="flex flex-col h-full overflow-hidden">
              <MenuHeader />

              <div id="menu-inline-toast" className="hidden px-5 py-1.5 text-xs text-primary font-orbitron" />
              <div id="active-match-shell" className="hidden" />
              <div id="active-match-header-feedback" className="hidden" />

              <section
                id="menu-body"
                className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 min-h-0"
              >
                <div id="menu-screen-mode" className="menu-screen h-full" data-screen="main">
                  <ScreenRouter />
                </div>
              </section>

              <LoadoutBand />
            </div>
          </main>
        </div>
      )}

      <div id="runtime-indicator" className="fixed bottom-4 right-4 z-20 pointer-events-none font-orbitron text-[10px] tracking-widest text-foreground/70" />
      <div id="debug-info" className="fixed bottom-4 left-4 z-20 max-w-[min(44rem,calc(100vw-2rem))] rounded-lg bg-background/80 px-3 py-2 text-[11px] leading-4 text-foreground/80 backdrop-blur-sm whitespace-pre-wrap" />
      <div id="idle-warning" hidden className="fixed top-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-destructive/85 px-3 py-1.5 font-orbitron text-[10px] tracking-wider text-destructive-foreground" />

      <MatchOverlay />
    </div>
  );
};

const Index: React.FC = () => {
  return (
    <AuthProvider>
      <RoomProvider>
        <MenuNavProvider>
          <OverlayShell />
        </MenuNavProvider>
      </RoomProvider>
    </AuthProvider>
  );
};

export default Index;

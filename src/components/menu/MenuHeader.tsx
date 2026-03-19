import React from 'react';
import { Settings, ChevronLeft, Copy, LogIn, User } from 'lucide-react';
import { useMenuNav, type MenuScreen } from '@/hooks/useMenuNav';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const SCREEN_TITLES: Record<MenuScreen, string> = {
  home: 'MAYHEM',
  social: 'SOCIAL',
  room: 'PRIVATE ROOM',
  settings: 'SETTINGS',
  auth: 'ACCOUNT',
  manual: 'FIELD MANUAL',
  controls: 'CONTROLS',
};

interface MenuHeaderProps {
  partyId?: string;
}

const MenuHeader: React.FC<MenuHeaderProps> = () => {
  const { current, history, pop, push } = useMenuNav();
  const { isLoggedIn, actorId, displayName } = useAuth();
  const canGoBack = history.length > 1;

  return (
    <header id="menu-header" className="px-4 sm:px-5 py-3 border-b border-border/30 flex-shrink-0">
      <div id="menu-header-main" className="flex items-center justify-between">
        <div id="menu-header-leading" className="flex items-center gap-2.5">
          {canGoBack && (
            <button
              id="menu-return-btn"
              className="pill-btn w-8 h-8 !p-0 flex items-center justify-center"
              onClick={pop}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="font-orbitron text-xs font-bold tracking-wider text-foreground">
            {SCREEN_TITLES[current]}
          </span>
          {current === 'home' && (
            <div
              id="menu-party-id-btn"
              className="pill-btn gap-1.5 cursor-pointer group ml-2"
              onClick={() => {
                if (isLoggedIn) {
                  push('auth');
                } else if (actorId) {
                  try {
                    navigator.clipboard.writeText(actorId);
                    toast({ title: 'Copied to clipboard', description: actorId });
                  } catch {
                    toast({ title: 'Failed to copy', description: 'Clipboard not available', variant: 'destructive' });
                  }
                }
              }}
            >
              <span id="menu-party-id-label" className="text-muted-foreground group-hover:text-foreground transition-colors text-[10px]">
                {isLoggedIn ? displayName : 'PLAYER ID'}
              </span>
              <span id="menu-party-id-value" className="text-primary font-bold text-[10px] font-mono">{actorId?.slice(0, 12)}</span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!actorId) return;
                  try {
                    navigator.clipboard.writeText(actorId);
                    toast({ title: 'Copied to clipboard', description: actorId });
                  } catch {
                    toast({ title: 'Failed to copy', description: 'Clipboard not available', variant: 'destructive' });
                  }
                }}
              >
                <Copy className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          )}
        </div>
        <div id="menu-header-actions" className="flex items-center gap-2">
          {/* Login button — guest only, visible on home */}
          {!isLoggedIn && current === 'home' && (
            <button
              id="menu-login-btn"
              className="pill-btn active gap-1.5"
              onClick={() => push('auth')}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="text-[10px]">LOGIN</span>
            </button>
          )}
          {current !== 'settings' && (
            <button
              id="utility-toggle-btn"
              className="pill-btn gap-1.5"
              onClick={() => push('settings')}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">SETTINGS</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default MenuHeader;

import React, { useState } from 'react';
import { Crosshair, ChevronDown, Zap, Swords, Target, Dumbbell } from 'lucide-react';

interface GameMode {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const GAME_MODES: GameMode[] = [
  { id: 'ffa', label: 'FREE FOR ALL', icon: <Crosshair className="w-4 h-4" />, description: 'Every player for themselves' },
  { id: 'tdm', label: 'TEAM DEATHMATCH', icon: <Swords className="w-4 h-4" />, description: 'Team-based combat' },
  { id: 'lms', label: 'LAST MAN STANDING', icon: <Target className="w-4 h-4" />, description: 'Survive to win' },
  { id: 'practice', label: 'PRACTICE', icon: <Dumbbell className="w-4 h-4" />, description: 'Hone your skills' },
];

const HomeHero: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState('ffa');
  const [modesOpen, setModesOpen] = useState(false);

  const currentMode = GAME_MODES.find(m => m.id === selectedMode)!;

  return (
    <div id="menu-home-hero" className="glass-card p-6 sm:p-8 flex flex-col gap-6 animate-fade-in-up">
      <div>
        <p id="mode-screen-kicker" className="section-label text-primary !mb-1">
          <Zap className="w-3 h-3 inline mr-1" />
          READY TO DEPLOY
        </p>
        <h1 id="mode-screen-title" className="font-orbitron text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          MAYHEM
        </h1>
      </div>

      <div id="play-mode-group" className="flex flex-col gap-4">
        <div id="play-mode-toolbar" className="flex items-center gap-3">
          <button
            id="primary-launch-btn"
            className="launch-btn flex-1 animate-pulse-glow"
          >
            PLAY {currentMode.label}
          </button>
          <button
            id="game-modes-toggle-btn"
            className={`pill-btn !rounded-xl !px-3 !py-3 transition-transform ${modesOpen ? 'rotate-180 active' : ''}`}
            onClick={() => setModesOpen(!modesOpen)}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {modesOpen && (
          <div id="play-mode-options" className="grid grid-cols-2 gap-2 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            {GAME_MODES.map(mode => (
              <button
                key={mode.id}
                id={mode.id === 'practice' ? 'practice-mode-btn' : `play-mode-${mode.id}-btn`}
                className={`item-grid-btn !rounded-xl !p-4 text-left ${selectedMode === mode.id ? 'selected' : ''}`}
                onClick={() => { setSelectedMode(mode.id); setModesOpen(false); }}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={selectedMode === mode.id ? 'text-primary' : ''}>{mode.icon}</span>
                  <span className="font-orbitron text-[10px] font-bold tracking-wider">{mode.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 font-rajdhani">{mode.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div id="room-access-status" className="text-xs text-muted-foreground font-rajdhani font-medium" />
    </div>
  );
};

export default HomeHero;

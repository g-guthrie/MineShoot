import React, { useState } from 'react';
import { BookOpen, Crosshair, Zap, Bomb, Sliders } from 'lucide-react';

const PAGES = [
  { id: 'briefing', label: 'BRIEFING', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'controls', label: 'CONTROLS', icon: <Sliders className="w-3.5 h-3.5" /> },
  { id: 'weapons', label: 'WEAPONS', icon: <Crosshair className="w-3.5 h-3.5" /> },
  { id: 'abilities', label: 'ABILITIES', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'throwables', label: 'THROWABLES', icon: <Bomb className="w-3.5 h-3.5" /> },
];

const ManualScreen: React.FC = () => {
  const [activePage, setActivePage] = useState('briefing');

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {PAGES.map(page => (
          <button
            key={page.id}
            className={`tab-btn flex items-center gap-1.5 whitespace-nowrap ${activePage === page.id ? 'active' : ''}`}
            onClick={() => setActivePage(page.id)}
          >
            {page.icon}
            {page.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="glass-card p-5 flex-1 overflow-y-auto">
        {activePage === 'briefing' && (
          <div className="flex flex-col gap-3">
            <h3 className="font-orbitron text-sm font-bold text-primary">MISSION BRIEFING</h3>
            <p className="font-rajdhani text-sm text-foreground/80 leading-relaxed">
              Welcome to MAYHEM — a fast-paced arena FPS. Choose your weapons, abilities, and throwables, then enter the arena to dominate.
            </p>
            <p className="font-rajdhani text-sm text-foreground/80 leading-relaxed">
              Play solo in Free For All, team up in Team Deathmatch, or prove your survival in Last Man Standing.
            </p>
          </div>
        )}
        {activePage === 'weapons' && (
          <div className="flex flex-col gap-2">
            <h3 className="font-orbitron text-sm font-bold text-primary">ARSENAL</h3>
            {['Machine Gun', 'Shotgun', 'Rifle', 'Pistol', 'Sniper'].map(w => (
              <div key={w} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/20 cursor-pointer transition-colors">
                <Crosshair className="w-4 h-4 text-primary" />
                <span className="font-rajdhani font-semibold text-sm">{w}</span>
              </div>
            ))}
          </div>
        )}
        {activePage === 'abilities' && (
          <div className="flex flex-col gap-2">
            <h3 className="font-orbitron text-sm font-bold text-primary">ABILITIES</h3>
            {['Vader Choke', 'Chain Hook', 'Heal', 'Missile', 'Deadeye'].map(a => (
              <div key={a} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/20 cursor-pointer transition-colors">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-rajdhani font-semibold text-sm">{a}</span>
              </div>
            ))}
          </div>
        )}
        {activePage === 'throwables' && (
          <div className="flex flex-col gap-2">
            <h3 className="font-orbitron text-sm font-bold text-primary">THROWABLES</h3>
            {['Frag Grenade', 'Plasma Grenade', 'Molotov', 'Knife'].map(t => (
              <div key={t} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/20 cursor-pointer transition-colors">
                <Bomb className="w-4 h-4 text-primary" />
                <span className="font-rajdhani font-semibold text-sm">{t}</span>
              </div>
            ))}
          </div>
        )}
        {activePage === 'controls' && (
          <div className="flex flex-col gap-2">
            <h3 className="font-orbitron text-sm font-bold text-primary">DEFAULT CONTROLS</h3>
            {[
              ['WASD', 'Movement'], ['Mouse', 'Look / Aim'], ['LMB', 'Fire'],
              ['RMB', 'Alt Fire'], ['Space', 'Jump'], ['Shift', 'Sprint'],
              ['Q / E', 'Abilities'], ['G', 'Throwable'], ['R', 'Reload'],
            ].map(([key, action]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/20 transition-colors">
                <span className="font-rajdhani text-sm text-foreground/80">{action}</span>
                <span className="font-orbitron text-[10px] font-bold text-primary tracking-wider bg-primary/10 px-2 py-1 rounded-lg">{key}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualScreen;

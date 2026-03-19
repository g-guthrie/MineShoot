import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface Binding {
  action: string;
  key: string;
}

const DEFAULT_BINDINGS: Binding[] = [
  { action: 'Move Forward', key: 'W' },
  { action: 'Move Back', key: 'S' },
  { action: 'Move Left', key: 'A' },
  { action: 'Move Right', key: 'D' },
  { action: 'Jump', key: 'Space' },
  { action: 'Sprint', key: 'Shift' },
  { action: 'Fire', key: 'LMB' },
  { action: 'Alt Fire', key: 'RMB' },
  { action: 'Reload', key: 'R' },
  { action: 'Ability 1', key: 'Q' },
  { action: 'Ability 2', key: 'E' },
  { action: 'Throwable', key: 'G' },
  { action: 'Interact', key: 'F' },
];

const ControlsScreen: React.FC = () => {
  const [bindings, setBindings] = useState<Binding[]>(DEFAULT_BINDINGS);
  const [rebinding, setRebinding] = useState<number | null>(null);

  const handleRebind = (idx: number) => {
    setRebinding(idx);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape') {
        setRebinding(null);
      } else {
        setBindings(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], key: e.key.length === 1 ? e.key.toUpperCase() : e.key };
          return next;
        });
        setRebinding(null);
      }
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('keydown', handler);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="glass-card p-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {bindings.map((b, i) => (
            <div key={b.action} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/20 transition-colors">
              <span className="font-rajdhani font-semibold text-sm text-foreground/80">{b.action}</span>
              <button
                className={`font-orbitron text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                  rebinding === i
                    ? 'border-primary text-primary bg-primary/10 animate-pulse'
                    : 'border-border/50 text-primary bg-primary/5 hover:bg-primary/10'
                }`}
                onClick={() => handleRebind(i)}
              >
                {rebinding === i ? 'PRESS KEY' : b.key}
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        className="pill-btn !rounded-xl w-full justify-center !py-3 gap-2"
        onClick={() => setBindings(DEFAULT_BINDINGS)}
      >
        <RotateCcw className="w-3.5 h-3.5" /> RESET DEFAULTS
      </button>
    </div>
  );
};

export default ControlsScreen;

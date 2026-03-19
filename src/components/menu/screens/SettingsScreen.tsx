import React from 'react';
import { User, Gamepad2, Volume2, BookOpen, LogIn } from 'lucide-react';
import { useMenuNav } from '@/hooks/useMenuNav';
import { useAuth } from '@/hooks/useAuth';

const SettingsScreen: React.FC = () => {
  const { push } = useMenuNav();
  const { isLoggedIn } = useAuth();

  const items = [
    {
      id: 'auth',
      label: isLoggedIn ? 'PROFILE' : 'LOGIN',
      icon: isLoggedIn ? <User className="w-4 h-4" /> : <LogIn className="w-4 h-4" />,
      action: () => push('auth'),
    },
    { id: 'controls', label: 'CONTROLS', icon: <Gamepad2 className="w-4 h-4" />, action: () => push('controls') },
    { id: 'sound', label: 'SOUND', icon: <Volume2 className="w-4 h-4" />, action: undefined },
    { id: 'manual', label: 'INSTRUCTIONS', icon: <BookOpen className="w-4 h-4" />, action: () => push('manual') },
  ];

  return (
    <div id="utility-overlay" className="flex flex-col gap-3">
      <div id="utility-modal" className="flex flex-col gap-2">
        {items.map(item => (
          <button
            key={item.id}
            className="glass-card p-4 flex items-center gap-3 cursor-pointer group text-left w-full"
            onClick={item.action}
          >
            <span className="text-primary group-hover:scale-110 transition-transform">{item.icon}</span>
            <span className="font-orbitron text-xs font-bold tracking-wider text-foreground">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsScreen;

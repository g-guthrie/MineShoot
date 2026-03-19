import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type MenuScreen = 
  | 'home' 
  | 'social' 
  | 'room' 
  | 'settings' 
  | 'auth' 
  | 'manual' 
  | 'controls';

interface MenuNavState {
  current: MenuScreen;
  direction: 'forward' | 'back';
  history: MenuScreen[];
  push: (screen: MenuScreen) => void;
  pop: () => void;
  reset: () => void;
}

const MenuNavContext = createContext<MenuNavState | null>(null);

export const MenuNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<MenuScreen[]>(['home']);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const current = history[history.length - 1];

  const push = useCallback((screen: MenuScreen) => {
    setDirection('forward');
    setHistory(prev => [...prev, screen]);
  }, []);

  const pop = useCallback(() => {
    setDirection('back');
    setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(() => {
    setDirection('back');
    setHistory(['home']);
  }, []);

  return (
    <MenuNavContext.Provider value={{ current, direction, history, push, pop, reset }}>
      {children}
    </MenuNavContext.Provider>
  );
};

export const useMenuNav = () => {
  const ctx = useContext(MenuNavContext);
  if (!ctx) throw new Error('useMenuNav must be used within MenuNavProvider');
  return ctx;
};

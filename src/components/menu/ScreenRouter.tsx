import React, { useRef, useEffect, useState } from 'react';
import { useMenuNav } from '@/hooks/useMenuNav';
import HomeScreen from './screens/HomeScreen';
import SocialScreen from './screens/SocialScreen';
import RoomScreen from './screens/RoomScreen';
import SettingsScreen from './screens/SettingsScreen';
import AuthScreen from './screens/AuthScreen';
import ManualScreen from './screens/ManualScreen';
import ControlsScreen from './screens/ControlsScreen';

const screens = {
  home: HomeScreen,
  social: SocialScreen,
  room: RoomScreen,
  settings: SettingsScreen,
  auth: AuthScreen,
  manual: ManualScreen,
  controls: ControlsScreen,
};

const ScreenRouter: React.FC = () => {
  const { current, direction } = useMenuNav();
  const [displayed, setDisplayed] = useState(current);
  const [animClass, setAnimClass] = useState('');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayed(current);
      return;
    }

    // Animate out, then swap and animate in
    const outClass = direction === 'forward' ? 'screen-slide-out-left' : 'screen-slide-out-right';
    setAnimClass(outClass);

    const timer = setTimeout(() => {
      setDisplayed(current);
      const inClass = direction === 'forward' ? 'screen-slide-in-right' : 'screen-slide-in-left';
      setAnimClass(inClass);

      const clearTimer = setTimeout(() => setAnimClass(''), 250);
      return () => clearTimeout(clearTimer);
    }, 200);

    return () => clearTimeout(timer);
  }, [current, direction]);

  const ScreenComponent = screens[displayed];

  return (
    <div className={`h-full ${animClass}`}>
      <ScreenComponent />
    </div>
  );
};

export default ScreenRouter;

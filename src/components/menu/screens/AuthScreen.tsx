import React, { useRef, useState } from 'react';
import { User, LogIn, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMenuNav } from '@/hooks/useMenuNav';

const AuthScreen: React.FC = () => {
  const { isLoggedIn, displayName, login, logout } = useAuth();
  const { pop } = useMenuNav();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('');
  const wasLoggedInOnMount = useRef(isLoggedIn);

  const handleLogin = async () => {
    if (!username.trim()) {
      setStatus('Enter a username.');
      return;
    }
    if (pin.trim().length !== 4) {
      setStatus('PIN must be exactly 4 digits.');
      return;
    }
    const result = await login(username.trim(), pin.trim());
    if (!result.ok) {
      setStatus(result.error || 'Login failed.');
      return;
    }
    setStatus('');
    pop();
  };

  const handleLogout = async () => {
    await logout();
    pop();
  };

  if (isLoggedIn && wasLoggedInOnMount.current) {
    return (
      <div className="flex flex-col gap-4">
        <div className="glass-card p-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <UserCircle className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="font-orbitron text-lg font-bold text-foreground">{displayName}</h2>
            <p className="text-xs text-muted-foreground font-rajdhani mt-1">Signed in and ready for matchmaking.</p>
          </div>
        </div>

        <button
          className="pill-btn w-full justify-center !py-3 text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
          onClick={handleLogout}
        >
          <LogOut className="w-3.5 h-3.5" /> LOG OUT
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="text-center mb-2">
          <User className="w-8 h-8 text-primary mx-auto mb-2" />
          <h2 className="font-orbitron text-lg font-bold text-foreground">SIGN IN</h2>
          <p className="text-xs text-muted-foreground font-rajdhani mt-1">Enter your callsign and 4-digit PIN</p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            className="glass-input"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            className="glass-input"
            type="password"
            placeholder="4-Digit PIN"
            maxLength={4}
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
              if (status) setStatus('');
            }}
          />
        </div>

        {status && <div className="text-xs font-rajdhani text-destructive">{status}</div>}

        <button
          className="launch-btn w-full gap-2"
          onClick={handleLogin}
        >
          <LogIn className="w-4 h-4" /> ENTER
        </button>
      </div>

      <button
        className="pill-btn w-full justify-center !py-3"
        onClick={pop}
      >
        PLAY AS GUEST
      </button>
    </div>
  );
};

export default AuthScreen;

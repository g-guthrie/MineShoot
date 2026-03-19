import { useEffect, useRef } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { gameBridge } from '@/lib/game-bridge';

const GameBridgeSync = () => {
  const { matchState, countdownValue, players, mode, isPaused } = useRoom();
  const prevMatchState = useRef(matchState);
  const prevPaused = useRef(isPaused);

  useEffect(() => {
    const prev = prevMatchState.current;
    prevMatchState.current = matchState;

    if (prev !== matchState) {
      switch (matchState) {
        case 'countdown':
          gameBridge.emit('countdown', { value: countdownValue });
          break;
        case 'in-match':
          gameBridge.emit('match-start', {
            players: players.map((player) => ({ id: player.id, name: player.name })),
            mode,
          });
          break;
        case 'post-match':
          gameBridge.emit('match-end');
          break;
        case 'idle':
          if (prev === 'post-match' || prev === 'in-match') {
            gameBridge.emit('return-to-lobby');
          }
          break;
      }
    }
  }, [matchState, countdownValue, players, mode]);

  useEffect(() => {
    if (matchState === 'countdown') {
      gameBridge.emit('countdown', { value: countdownValue });
    }
  }, [countdownValue, matchState]);

  useEffect(() => {
    if (prevPaused.current !== isPaused) {
      prevPaused.current = isPaused;
      gameBridge.emit(isPaused ? 'pause' : 'unpause');
    }
  }, [isPaused]);

  return null;
};

export default GameBridgeSync;

type GameEvent =
  | 'countdown'
  | 'match-start'
  | 'match-end'
  | 'pause'
  | 'unpause'
  | 'return-to-lobby';

type Callback = (data?: unknown) => void;

const listeners = new Map<GameEvent, Set<Callback>>();

export const gameBridge = {
  emit(event: GameEvent, data?: unknown) {
    listeners.get(event)?.forEach((fn) => fn(data));
  },

  on(event: GameEvent, fn: Callback): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return () => {
      listeners.get(event)?.delete(fn);
    };
  },

  off(event: GameEvent, fn: Callback) {
    listeners.get(event)?.delete(fn);
  },

  clear() {
    listeners.clear();
  },
};

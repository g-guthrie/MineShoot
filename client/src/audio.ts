/**
 * Event-driven sound effects using the reference build's SFX files.
 * HTMLAudio with cached sources; cloned per play so shots can overlap.
 */
import type { SimEvent } from '../../sim/types';
import type { Snapshot } from '../../protocol/index';
import type { WeaponId } from '../../sim/constants';

const SHOOT_SOUND: Record<WeaponId, string> = {
  pistol: '/audio/sfx/pistol-shoot.mp3',
  'auto-pistol': '/audio/sfx/pistol-shoot.mp3',
  ar15: '/audio/sfx/rifle-shoot.mp3',
  ak47: '/audio/sfx/rifle-shoot.mp3',
  shotgun: '/audio/sfx/shotgun-shoot.mp3',
  'auto-shotgun': '/audio/sfx/shotgun-shoot.mp3',
};

const RELOAD_SOUND: Record<WeaponId, string> = {
  pistol: '/audio/sfx/pistol-reload.mp3',
  'auto-pistol': '/audio/sfx/pistol-reload.mp3',
  ar15: '/audio/sfx/rifle-reload.mp3',
  ak47: '/audio/sfx/rifle-reload.mp3',
  shotgun: '/audio/sfx/shotgun-reload.mp3',
  'auto-shotgun': '/audio/sfx/shotgun-reload.mp3',
};

export class Sfx {
  private cache = new Map<string, HTMLAudioElement>();

  private play(src: string, volume: number): void {
    let base = this.cache.get(src);
    if (!base) {
      base = new Audio(src);
      base.preload = 'auto';
      this.cache.set(src, base);
    }
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.volume = Math.max(0, Math.min(1, volume));
    void node.play().catch(() => {
      // Autoplay restrictions before first interaction; ignore.
    });
  }

  handleEvents(events: SimEvent[], snapshot: Snapshot, myPlayerId: string | null): void {
    const me = snapshot.players.find(p => p.id === myPlayerId);

    const distanceVolume = (x: number, z: number, base: number): number => {
      if (!me) return base * 0.5;
      const d = Math.hypot(x - me.x, z - me.z);
      return base * Math.max(0.08, Math.min(1, 9 / (d + 3)));
    };

    for (const event of events) {
      switch (event.type) {
        case 'shot': {
          const shooter = snapshot.players.find(p => p.id === event.playerId);
          const volume =
            event.playerId === myPlayerId
              ? 0.35
              : shooter
                ? distanceVolume(shooter.x, shooter.z, 0.3)
                : 0.1;
          this.play(SHOOT_SOUND[event.weapon], volume);
          break;
        }
        case 'reloadStarted': {
          const who = snapshot.players.find(p => p.id === event.playerId);
          if (event.playerId === myPlayerId && who) {
            this.play(RELOAD_SOUND[who.weapon], 0.6);
          }
          break;
        }
        case 'enemyHurt':
        case 'enemyDied':
          this.play('/audio/sfx/zombie-hurt.mp3', 0.35);
          break;
        case 'playerHurt':
          if (event.playerId === myPlayerId) this.play('/audio/sfx/player-hurt.mp3', 0.7);
          break;
        case 'purchase':
          if (event.playerId === myPlayerId) this.play('/audio/sfx/purchase.mp3', 0.8);
          break;
        case 'crateRolled':
          this.play('/audio/sfx/roulette.mp3', 0.4);
          break;
        case 'waveStarted':
        case 'gameStarted':
          this.play('/audio/sfx/wave-start.mp3', 0.7);
          break;
        default:
          break;
      }
    }
  }
}

/**
 * DOM HUD, visually ported from the reference build's ui/index.html:
 * health bar, money, weapon + ammo, wave counter, boss bar, downed/game-over
 * overlays, message feed.
 */
import type { Snapshot, WirePlayer } from '../../protocol/index';
import type { SimEvent } from '../../sim/types';
import { WEAPONS } from '../../sim/constants';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing HUD element #${id}`);
  return el as T;
};

export class Hud {
  private waveLabel = $('wave-label');
  private phaseLabel = $('phase-label');
  private money = $('money');
  private healthFill = $('health-fill');
  private healthText = $('health-text');
  private weaponName = $('weapon-name');
  private weaponAmmo = $('weapon-ammo');
  private weaponIcon = $<HTMLImageElement>('weapon-icon');
  private bossBar = $('boss-bar');
  private bossFill = this.bossBar.querySelector('.fill') as HTMLElement;
  private announce = $('announce');
  private messages = $('messages');
  private centerOverlay = $('center-overlay');
  private damageFlash = $('damage-flash');

  private announceTimer: number | null = null;
  private lastWeapon = '';

  update(snapshot: Snapshot, me: WirePlayer | undefined): void {
    this.waveLabel.textContent = snapshot.phase === 'running' ? `Wave ${snapshot.wave}` : 'Lobby';

    if (snapshot.phase === 'countdown') {
      this.phaseLabel.textContent =
        snapshot.players.length > 0
          ? `Game starts in ${snapshot.countdownS}s`
          : 'Waiting for players…';
    } else if (snapshot.phase === 'gameover') {
      this.phaseLabel.textContent = 'Round over';
    } else {
      this.phaseLabel.textContent = `${snapshot.players.filter(p => !p.spectator).length} fighting`;
    }

    // Boss bar follows the strongest living ripper.
    const boss = snapshot.enemies
      .filter(e => e.kind === 'ripper')
      .sort((a, b) => b.maxHealth - a.maxHealth)[0];
    this.bossBar.style.display = boss ? 'block' : 'none';
    if (boss) {
      this.bossFill.style.width = `${Math.max(0, (boss.health / boss.maxHealth) * 100)}%`;
    }

    if (!me) return;

    this.money.textContent = `$${me.money}`;
    const healthPct = Math.max(0, (me.health / me.maxHealth) * 100);
    this.healthFill.style.width = `${healthPct}%`;
    this.healthText.textContent = `${Math.ceil(me.health)} / ${me.maxHealth}`;

    const spec = WEAPONS[me.weapon];
    this.weaponName.textContent = spec.name;
    if (me.reloading) {
      this.weaponAmmo.textContent = 'Reloading…';
      this.weaponAmmo.classList.add('reloading');
    } else {
      this.weaponAmmo.textContent = `${me.ammo} / ${spec.clipSize}`;
      this.weaponAmmo.classList.remove('reloading');
    }
    if (this.lastWeapon !== me.weapon) {
      this.lastWeapon = me.weapon;
      this.weaponIcon.src = `/${spec.iconUri}`;
    }

    this.updateCenterOverlay(snapshot, me);
  }

  private updateCenterOverlay(snapshot: Snapshot, me: WirePlayer): void {
    let html = '';
    if (snapshot.phase === 'gameover') {
      html = `<div class="big">Game Over</div><div class="sub">Your team made it to wave ${snapshot.wave}</div>`;
    } else if (me.downed) {
      html = `<div class="big">You are downed</div><div class="sub">A teammate can revive you — they hold E next to you</div>`;
    } else if (me.spectator) {
      html = `<div class="sub">Round in progress — you join when the next round starts.</div>`;
    }
    this.centerOverlay.innerHTML = html;
    this.centerOverlay.style.display = html ? 'block' : 'none';
  }

  handleEvents(events: SimEvent[], myPlayerId: string | null): void {
    for (const event of events) {
      switch (event.type) {
        case 'waveStarted':
          this.showAnnounce(`Wave ${event.wave}`);
          break;
        case 'bossSpawned':
          this.showAnnounce('THE RIPPER');
          break;
        case 'gameStarted':
          this.showAnnounce('They are coming…');
          break;
        case 'playerHurt':
          if (event.playerId === myPlayerId) this.flashDamage();
          break;
        case 'message':
          if (!event.toPlayerId || event.toPlayerId === myPlayerId) {
            this.pushMessage(event.text, event.color);
          }
          break;
        default:
          break;
      }
    }
  }

  private showAnnounce(text: string): void {
    this.announce.textContent = text;
    this.announce.style.opacity = '1';
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      this.announce.style.opacity = '0';
    }, 2_500);
  }

  private flashDamage(): void {
    this.damageFlash.style.transition = 'none';
    this.damageFlash.style.opacity = '1';
    requestAnimationFrame(() => {
      this.damageFlash.style.transition = 'opacity 0.35s ease-out';
      this.damageFlash.style.opacity = '0';
    });
  }

  private pushMessage(text: string, color: string): void {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.color = `#${color}`;
    this.messages.appendChild(div);
    while (this.messages.children.length > 6) {
      this.messages.firstChild?.remove();
    }
    setTimeout(() => div.remove(), 8_000);
  }
}

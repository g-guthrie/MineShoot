import { WEAPONS } from '../shared/constants.js';

export class Hud {
  constructor(root = document) {
    this.health = root.getElementById('hud-health');
    this.kills = root.getElementById('hud-kills');
    this.deaths = root.getElementById('hud-deaths');
    this.weapon = root.getElementById('hud-weapon');
    this.room = root.getElementById('hud-room');
    this.feed = root.getElementById('feed');
    this.hitmarker = root.getElementById('hitmarker');
    this.startPanel = root.getElementById('start-panel');
    this.startBtn = root.getElementById('start-btn');
    this.feedItems = [];
  }

  hideStart() {
    if (this.startPanel) this.startPanel.hidden = true;
  }

  update(snapshot, selfId) {
    const self = snapshot && Array.isArray(snapshot.entities)
      ? snapshot.entities.find((entity) => entity.id === selfId)
      : null;
    if (!self) return;
    if (this.health) this.health.textContent = String(Math.round(self.health || 0));
    if (this.kills) this.kills.textContent = String(self.kills || 0);
    if (this.deaths) this.deaths.textContent = String(self.deaths || 0);
    if (this.weapon) this.weapon.textContent = (WEAPONS[self.weaponId] || WEAPONS.rifle).name;
    if (this.room && snapshot.roomId) this.room.textContent = snapshot.roomId;
  }

  pushFeed(text) {
    if (!this.feed || !text) return;
    this.feedItems.unshift(String(text));
    this.feedItems = this.feedItems.slice(0, 5);
    this.feed.innerHTML = '';
    for (const item of this.feedItems) {
      const div = document.createElement('div');
      div.textContent = item;
      this.feed.appendChild(div);
    }
  }

  flashHitmarker() {
    if (!this.hitmarker) return;
    this.hitmarker.classList.remove('active');
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('active');
  }
}


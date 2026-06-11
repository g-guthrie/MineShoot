/**
 * hud.js - DOM heads-up display: vitals, ammo, kill feed, scoreboard,
 * death overlay, toasts.
 */
import { WEAPONS, WEAPON_SLOTS, PLAYER_MAX_HP } from '../shared/combat.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const hpFill = el('hp-fill');
  const hpLabel = el('hp-label');
  const ammoCount = document.querySelector('#ammo .count');
  const ammoMag = document.querySelector('#ammo .count .mag');
  const weaponName = document.querySelector('#ammo .weapon-name');
  const blocksCount = el('blocks-count');
  const weaponBar = el('weapon-bar');
  const killfeed = el('killfeed');
  const scoreboard = el('scoreboard');
  const scoreboardBody = el('scoreboard-body');
  const vignette = el('damage-vignette');
  const hitmarkerEl = el('hitmarker');
  const deathOverlay = el('death-overlay');
  const deathBy = el('death-by');
  const deathHint = el('death-hint');
  const toastEl = el('toast');
  const scopeEl = el('scope');
  const crosshairEl = el('crosshair');
  const matchTimer = el('match-timer');
  const matchEnd = el('match-end');
  const podium = el('podium');

  let hitmarkerTimer = null;
  let vignetteTimer = null;
  let toastTimer = null;

  // Build weapon slot chips once.
  WEAPON_SLOTS.forEach((id, index) => {
    const slot = document.createElement('div');
    slot.className = 'weapon-slot';
    slot.dataset.weapon = id;
    slot.innerHTML = `<span class="key">${index + 1}</span>${WEAPONS[id].name}`;
    weaponBar.appendChild(slot);
  });

  return {
    show() { hud.style.display = 'block'; },
    hide() {
      hud.style.display = 'none';
      deathOverlay.style.display = 'none';
    },

    setHp(hp) {
      const pct = Math.max(0, Math.min(100, (hp / PLAYER_MAX_HP) * 100));
      hpFill.style.width = pct + '%';
      hpFill.classList.toggle('low', pct < 35);
      hpLabel.textContent = Math.max(0, Math.round(hp)) + ' HP';
    },

    setAmmo(inMag, reloading) {
      ammoMag.textContent = reloading ? '--' : String(inMag);
      ammoCount.classList.toggle('reloading', !!reloading);
    },

    setWeapon(weaponId) {
      weaponName.textContent = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;
      for (const slot of weaponBar.children) {
        slot.classList.toggle('active', slot.dataset.weapon === weaponId);
      }
    },

    setBlocks(count) {
      blocksCount.innerHTML = '&#9632; ' + count + ' blocks';
    },

    killFeed(killer, victim, weaponId, head) {
      const row = document.createElement('div');
      row.className = 'kill-row';
      const icon = head ? ' &#127919; ' : ' &#10013; ';
      row.innerHTML = `<span class="killer">${escapeHtml(killer || '?')}</span>${icon}<span class="victim">${escapeHtml(victim || '?')}</span>`;
      killfeed.prepend(row);
      while (killfeed.children.length > 5) killfeed.lastChild.remove();
      setTimeout(() => row.remove(), 6000);
    },

    setScores(scores, selfId) {
      scoreboardBody.innerHTML = '';
      for (const row of scores || []) {
        const tr = document.createElement('tr');
        if (row.id === selfId) tr.className = 'me';
        tr.innerHTML = `<td>${escapeHtml(row.name)}</td><td>${row.kills}</td><td>${row.deaths}</td>`;
        scoreboardBody.appendChild(tr);
      }
    },

    toggleScoreboard(shown) {
      scoreboard.style.display = shown ? 'block' : 'none';
    },

    setScope(shown) {
      scopeEl.style.display = shown ? 'block' : 'none';
      crosshairEl.style.display = shown ? 'none' : 'block';
    },

    setMatchTimer(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(total / 60);
      const seconds = String(total % 60).padStart(2, '0');
      matchTimer.textContent = `${minutes}:${seconds}`;
      matchTimer.classList.toggle('ending', total <= 30);
    },

    showMatchEnd(scores, selfId) {
      podium.innerHTML = '';
      (scores || []).slice(0, 3).forEach((row, index) => {
        const div = document.createElement('div');
        div.className = 'podium-row' + (index === 0 ? ' first' : '');
        const youTag = row.id === selfId ? ' (you)' : '';
        div.innerHTML = `<span>#${index + 1} ${escapeHtml(row.name)}${youTag}</span><span>${row.kills} kills</span>`;
        podium.appendChild(div);
      });
      matchEnd.style.display = 'flex';
    },

    hideMatchEnd() {
      matchEnd.style.display = 'none';
    },

    hitmarker(head) {
      hitmarkerEl.classList.toggle('head', !!head);
      hitmarkerEl.style.opacity = '1';
      clearTimeout(hitmarkerTimer);
      hitmarkerTimer = setTimeout(() => { hitmarkerEl.style.opacity = '0'; }, 90);
    },

    damageFlash() {
      vignette.style.opacity = '1';
      clearTimeout(vignetteTimer);
      vignetteTimer = setTimeout(() => { vignette.style.opacity = '0'; }, 220);
    },

    showDeath(killerName) {
      deathBy.textContent = 'Eliminated by ' + killerName;
      deathOverlay.style.display = 'flex';
    },

    deathCountdown(remainingMs) {
      deathHint.textContent = 'Respawning in ' + (remainingMs / 1000).toFixed(1) + 's';
    },

    hideDeath() {
      deathOverlay.style.display = 'none';
    },

    toast(text) {
      toastEl.textContent = text;
      toastEl.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2500);
    }
  };
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

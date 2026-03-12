import { createBloomReticle } from './bloom-reticle.js';

/**
 * ui.js - Minimal HUD for the rifle-only multiplayer slice
 */

export const GameUI = {};

let crosshairEl = null;
let bloomReticleEl = null;
let bloomReticle = null;
let hitmarkerEl = null;
let killCounterEl = null;
let healthBarEl = null;
let healthTextEl = null;
let armorBarEl = null;
let damageNumbersEl = null;
let debugInfoEl = null;
let weaponInfoEl = null;
let cooldownBarEl = null;
let cooldownStatusEl = null;
let damageVignetteEl = null;
let damageIndicatorEl = null;

let killCount = 0;
let hitmarkerTimer = null;
let damageTicks = [];
let damageTickTimers = [];
let damageFlashLevel = 0;

function wrapAngleRad(rad) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

GameUI.init = function init() {
  crosshairEl = document.getElementById('crosshair');
  bloomReticleEl = document.getElementById('bloom-reticle');
  bloomReticle = createBloomReticle(bloomReticleEl);
  hitmarkerEl = document.getElementById('hitmarker');
  killCounterEl = document.getElementById('kill-counter');
  healthBarEl = document.getElementById('health-bar');
  healthTextEl = document.getElementById('health-text');
  armorBarEl = document.getElementById('armor-bar');
  damageNumbersEl = document.getElementById('damage-numbers');
  debugInfoEl = document.getElementById('debug-info');
  weaponInfoEl = document.getElementById('weapon-info');
  cooldownBarEl = document.getElementById('cooldown-bar');
  cooldownStatusEl = document.getElementById('cooldown-status');
  damageVignetteEl = document.getElementById('damage-vignette');
  damageIndicatorEl = document.getElementById('damage-indicator');

  killCount = 0;
  GameUI.updateKillCounter();
  damageTicks = [];
  damageTickTimers = [];
  damageFlashLevel = 0;

  if (damageIndicatorEl) {
    damageIndicatorEl.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const tick = document.createElement('div');
      tick.className = 'damage-sector';

      const halfStep = Math.PI / 12;
      const centerAngle = (-Math.PI / 2) + (i * (Math.PI / 6));
      const a0 = centerAngle - halfStep;
      const a1 = centerAngle + halfStep;
      const r = 140;
      const x0 = 50 + Math.cos(a0) * r;
      const y0 = 50 + Math.sin(a0) * r;
      const x1 = 50 + Math.cos(a1) * r;
      const y1 = 50 + Math.sin(a1) * r;
      tick.style.clipPath = 'polygon(50% 50%, ' +
        x0.toFixed(2) + '% ' + y0.toFixed(2) + '%, ' +
        x1.toFixed(2) + '% ' + y1.toFixed(2) + '%)';

      damageIndicatorEl.appendChild(tick);
      damageTicks.push(tick);
      damageTickTimers.push(0);
    }
  }
};

GameUI.showHitMarker = function showHitMarker() {
  if (!hitmarkerEl) return;
  hitmarkerEl.style.transition = 'none';
  hitmarkerEl.style.opacity = '1';
  hitmarkerEl.style.color = '#ffffff';
  if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
  hitmarkerTimer = setTimeout(function clearMarker() {
    hitmarkerEl.style.transition = 'opacity 0.18s ease-out';
    hitmarkerEl.style.opacity = '0';
    hitmarkerEl.style.color = '#ff0000';
    hitmarkerTimer = null;
  }, 90);
};

GameUI.showKillMarker = function showKillMarker() {
  if (!hitmarkerEl) return;
  hitmarkerEl.style.transition = 'none';
  hitmarkerEl.style.opacity = '1';
  hitmarkerEl.style.color = '#ff4444';
  if (hitmarkerTimer) clearTimeout(hitmarkerTimer);
  hitmarkerTimer = setTimeout(function clearMarker() {
    hitmarkerEl.style.transition = 'opacity 0.25s ease-out';
    hitmarkerEl.style.opacity = '0';
    hitmarkerEl.style.color = '#ff0000';
    hitmarkerTimer = null;
  }, 300);
};

GameUI.addKill = function addKill() {
  killCount++;
  GameUI.updateKillCounter();
};

GameUI.updateKillCounter = function updateKillCounter() {
  if (killCounterEl) killCounterEl.textContent = 'Kills: ' + killCount;
};

GameUI.updateMatchStatus = function updateMatchStatus(matchState, selfState) {
  if (!killCounterEl) return;
  if (!matchState || !matchState.started) {
    GameUI.updateKillCounter();
    return;
  }
  const ownKills = Math.max(0, Number(selfState && selfState.kills || 0));
  killCounterEl.textContent = 'Kills: ' + ownKills + ' | Lead: ' +
    Number(matchState.leaderProgress || 0).toFixed(0) + ' / ' +
    Number(matchState.targetProgress || 0).toFixed(0);
};

GameUI.updateHealth = function updateHealth(hp, maxHp) {
  if (!healthBarEl || !healthTextEl) return;
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
  healthBarEl.style.width = pct + '%';
  healthTextEl.textContent = 'HP: ' + Math.ceil(hp);
  healthBarEl.style.background = pct > 60 ? '#4CAF50' : (pct > 30 ? '#FFC107' : '#F44336');
};

GameUI.updateArmor = function updateArmor(armor, armorMax) {
  if (!armorBarEl) return;
  const pct = Math.max(0, Math.min(100, (armor / Math.max(1, armorMax || 1)) * 100));
  armorBarEl.style.width = pct + '%';
};

GameUI.showDamageNumber = function showDamageNumber(worldPoint, damage, isKill, camera, hitType, options) {
  if (!damageNumbersEl || !worldPoint || !camera) return;
  options = options || {};
  const projected = worldPoint.clone().project(camera);
  if (projected.z > 1) return;
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

  const el = document.createElement('div');
  el.className = 'damage-number' + (isKill ? ' kill' : '') + (hitType === 'head' ? ' headshot' : '');
  el.textContent = isKill ? ('-' + Math.max(0, Math.round(damage || 0)) + ' KILL!') : ('-' + Math.max(0, Math.round(damage || 0)));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.marginLeft = ((Math.random() - 0.5) * (Number(options.spreadX) || 40)) + 'px';
  damageNumbersEl.appendChild(el);
  setTimeout(function removeDamageNumber() {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1000);
};

GameUI.setDebugInfo = function setDebugInfo(text) {
  if (debugInfoEl) debugInfoEl.textContent = text || '';
};

GameUI.setDebugVisuals = function setDebugVisuals(enabled) {
  if (bloomReticle && bloomReticle.setDebugEnabled) {
    bloomReticle.setDebugEnabled(!!enabled);
  }
};

GameUI.updateCooldown = function updateCooldown(ready, pct) {
  if (!cooldownBarEl || !cooldownStatusEl) return;
  cooldownBarEl.style.width = (Math.max(0, Math.min(1, pct)) * 100) + '%';
  cooldownBarEl.style.background = ready ? '#4CAF50' : '#FFC107';
  cooldownStatusEl.textContent = ready ? 'READY' : 'COOLDOWN';
  cooldownStatusEl.style.color = ready ? '#4CAF50' : '#FFC107';
};

GameUI.updateWeaponInfo = function updateWeaponInfo(weapon) {
  if (!weaponInfoEl || !weapon) return;
  weaponInfoEl.textContent = weapon.name + ' | SEMI | ' + weapon.bodyDamage + '/' + weapon.headDamage + ' DMG';
};

GameUI.updateReticle = function updateReticle(weapon, spec) {
  if (!crosshairEl || !bloomReticleEl || !weapon) return;
  crosshairEl.style.display = 'block';
  if (bloomReticle && bloomReticle.updateForWeapon) {
    bloomReticle.updateForWeapon(weapon, {
      adsActive: !!(spec && spec.adsActive),
      scoped: false
    });
  } else {
    bloomReticleEl.style.display = 'none';
  }
};

GameUI.setHitscanTargetState = function setHitscanTargetState(active) {
  if (crosshairEl) crosshairEl.classList.toggle('reticle-target-in-range', !!active);
};

GameUI.setShotgunTargetState = function noop() {};
GameUI.updateThrowableInfo = function noop() {};
GameUI.updateSniperScope = function noop() {};
GameUI.updatePlasmaState = function noop() {};
GameUI.updateSeekerReticle = function noop() {};
GameUI.updateCombatRadar = function noop() {};
GameUI.updateCombatBeacons = function noop() {};

GameUI.showDirectionalDamage = function showDirectionalDamage(sourcePos, playerPos, playerYaw, damage) {
  if (!sourcePos || !playerPos || typeof playerYaw !== 'number') return;
  if (!damageTicks || damageTicks.length !== 12) return;

  let toX = sourcePos.x - playerPos.x;
  let toZ = sourcePos.z - playerPos.z;
  const len = Math.sqrt(toX * toX + toZ * toZ);
  if (len <= 0.001) return;

  toX /= len;
  toZ /= len;

  const forwardX = -Math.sin(playerYaw);
  const forwardZ = -Math.cos(playerYaw);
  const rightX = Math.cos(playerYaw);
  const rightZ = -Math.sin(playerYaw);
  const frontDot = toX * forwardX + toZ * forwardZ;
  const rightDot = toX * rightX + toZ * rightZ;
  const angle = wrapAngleRad(Math.atan2(rightDot, frontDot));
  let sector = Math.round(angle / (Math.PI / 6));
  sector = ((sector % 12) + 12) % 12;

  const duration = 1.15 + Math.min(0.65, Number(damage || 0) / 90);
  damageTickTimers[sector] = Math.max(damageTickTimers[sector], duration);
  damageTickTimers[(sector + 1) % 12] = Math.max(damageTickTimers[(sector + 1) % 12], duration * 0.62);
  damageTickTimers[(sector + 11) % 12] = Math.max(damageTickTimers[(sector + 11) % 12], duration * 0.62);
  damageFlashLevel = Math.max(damageFlashLevel, 0.28 + Math.min(0.42, Number(damage || 0) / 120));
};

GameUI.updateDamageEffects = function updateDamageEffects(dt) {
  if (!damageTicks || damageTicks.length === 0) return;

  for (let i = 0; i < damageTickTimers.length; i++) {
    if (damageTickTimers[i] > 0) {
      damageTickTimers[i] -= dt;
      if (damageTickTimers[i] < 0) damageTickTimers[i] = 0;
    }
    damageTicks[i].style.opacity = Math.min(1, damageTickTimers[i]).toFixed(3);
  }

  if (damageFlashLevel > 0) {
    damageFlashLevel -= dt * 1.05;
    if (damageFlashLevel < 0) damageFlashLevel = 0;
  }

  if (damageVignetteEl) {
    damageVignetteEl.style.opacity = (damageFlashLevel * 0.62).toFixed(3);
  }
};

GameUI.getKillCount = function getKillCount() {
  return killCount;
};

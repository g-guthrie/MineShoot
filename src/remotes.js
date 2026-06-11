/**
 * remotes.js - Other players: keyframe-animated toon characters (CC0
 * Quaternius kit) interpolated between server snapshots, with an
 * animation state machine over the clip set (idle/walk/run/shoot/jump/
 * land/death).
 */
import { EYE_HEIGHT } from '../shared/combat.js';
import { WEAPONS, weaponOrDefault } from '../shared/combat.js';
import { createEffects } from './effects.js';
import { createCharacter } from './character.js';
import { audio } from './audio.js';

const THREE = globalThis.THREE;
const INTERP_DELAY_MS = 100;
const EXTRAPOLATION_MS = 120;
const BUFFER_LIMIT = 40;
const DEATH_LINGER_SECONDS = 1.6;
const RECENT_FIRE_MS = 450;

// Per-player outfit tints, deterministic by id.
const TINTS = [0x3aa655, 0x4a7fc1, 0xc14a4a, 0xc1a04a, 0x8e4ac1, 0x4ac1b4, 0xd4742c, 0x97a2ad];

function tintFor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

function makeNameSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 34px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const width = Math.min(250, ctx.measureText(name).width + 26);
  ctx.fillRect(128 - width / 2, 8, width, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 128, 33);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function createRemotes(scene) {
  const effects = createEffects(scene);
  const players = new Map(); // id -> remote record
  let localEntityRef = null;
  const scratch = new THREE.Vector3();

  function createRecord(p) {
    const root = new THREE.Group();
    const nameSprite = makeNameSprite(p.name || '?');
    nameSprite.position.set(0, 3.15, 0);
    root.add(nameSprite);
    scene.add(root);

    const record = {
      id: p.id,
      name: p.name || '?',
      root,
      char: null,
      flashUntil: 0,
      flashActive: false,
      lastHurtAudioAt: 0,
      lastFireAt: 0,
      alive: p.alive !== false,
      hp: p.hp,
      weapon: weaponOrDefault(p.weapon),
      buffer: [],
      display: {
        x: p.x, y: p.y, z: p.z,
        yaw: p.yaw || 0, pitch: p.pitch || 0,
        anim: p.anim || {}
      },
      lastDisplay: { x: p.x, y: p.y, z: p.z },
      worldSpeed: 0,
      wasAirborne: false,
      landingUntil: 0,
      dying: 0,
      removed: false
    };
    root.visible = record.alive;
    placeAvatar(record);

    createCharacter(tintFor(p.id)).then((char) => {
      if (record.removed) {
        char.dispose();
        return;
      }
      record.char = char;
      char.play('Idle', 0);
      root.add(char.root);
    }).catch((err) => {
      console.error('character load failed', err);
    });

    return record;
  }

  function placeAvatar(record) {
    const d = record.display;
    record.root.position.set(d.x, d.y - EYE_HEIGHT, d.z);
    record.root.rotation.y = d.yaw + Math.PI; // model faces +Z
  }

  function interpolate(record, renderAtMs) {
    const buffer = record.buffer;
    if (buffer.length === 0) return;
    if (buffer.length === 1) {
      Object.assign(record.display, buffer[0].state);
      return;
    }
    if (renderAtMs <= buffer[0].at) {
      Object.assign(record.display, buffer[0].state);
      return;
    }
    if (renderAtMs >= buffer[buffer.length - 1].at) {
      // Buffer underrun: extrapolate briefly along the last velocity so
      // remotes glide instead of stalling between late snapshots.
      const newest = buffer[buffer.length - 1];
      Object.assign(record.display, newest.state);
      if (buffer.length >= 2) {
        const prev = buffer[buffer.length - 2];
        const span = Math.max(1, newest.at - prev.at);
        const ahead = Math.min(EXTRAPOLATION_MS, renderAtMs - newest.at);
        const k = ahead / span;
        record.display.x += (newest.state.x - prev.state.x) * k;
        record.display.y += (newest.state.y - prev.state.y) * k;
        record.display.z += (newest.state.z - prev.state.z) * k;
      }
      return;
    }
    let older = buffer[0];
    let newer = buffer[buffer.length - 1];
    for (let i = buffer.length - 1; i > 0; i--) {
      if (buffer[i - 1].at <= renderAtMs) {
        older = buffer[i - 1];
        newer = buffer[i];
        break;
      }
    }
    const span = Math.max(1, newer.at - older.at);
    const t = Math.max(0, Math.min(1, (renderAtMs - older.at) / span));
    const a = older.state;
    const b = newer.state;
    record.display.x = a.x + (b.x - a.x) * t;
    record.display.y = a.y + (b.y - a.y) * t;
    record.display.z = a.z + (b.z - a.z) * t;
    record.display.yaw = lerpAngle(a.yaw, b.yaw, t);
    record.display.pitch = a.pitch + (b.pitch - a.pitch) * t;
    record.display.anim = b.anim || {};
  }

  function applyDamageFlash(record, nowMs) {
    if (!record.char) return;
    const shouldFlash = nowMs < record.flashUntil;
    if (shouldFlash === record.flashActive) return;
    record.flashActive = shouldFlash;
    for (const material of record.char.materials) {
      if (material.emissive) material.emissive.setHex(shouldFlash ? 0x9b1f1f : 0x000000);
    }
  }

  /** Picks the right clip for the current movement/combat state. */
  function chooseAnimation(record, nowMs) {
    const anim = record.display.anim || {};
    const airborne = !!anim.airborne;
    const shooting = !!anim.ads || nowMs - record.lastFireAt < RECENT_FIRE_MS;
    const speed = record.worldSpeed;

    // One-shot transitions for takeoff and landing.
    if (airborne && !record.wasAirborne) {
      record.wasAirborne = true;
      return 'Jump';
    }
    if (!airborne && record.wasAirborne) {
      record.wasAirborne = false;
      record.landingUntil = nowMs + 200;
      return 'Jump_Land';
    }
    record.wasAirborne = airborne;

    if (airborne) {
      // Let the takeoff clip finish before settling into the air loop.
      return record.char.currentAnimation() === 'Jump' && record.char.isPlayingOneShot()
        ? 'Jump'
        : 'Jump_Idle';
    }
    if (nowMs < record.landingUntil) return 'Jump_Land';
    if (speed > 6.5) return shooting ? 'Run_Shoot' : 'Run';
    if (speed > 0.8) return shooting ? 'Walk_Shoot' : 'Walk';
    return shooting ? 'Idle_Shoot' : 'Idle';
  }

  return {
    setLocalEntity(entity) {
      localEntityRef = entity;
    },

    reset() {
      for (const id of Array.from(players.keys())) this.remove(id);
    },

    upsert(p) {
      if (players.has(p.id)) return;
      players.set(p.id, createRecord(p));
    },

    remove(id) {
      const record = players.get(id);
      if (!record) return;
      record.removed = true;
      scene.remove(record.root);
      if (record.char) record.char.dispose();
      players.delete(id);
    },

    nameOf(id) {
      const record = players.get(id);
      return record ? record.name : '';
    },

    setHp(id, hp) {
      const record = players.get(id);
      if (record) record.hp = hp;
    },

    /** World position of a remote's head, for floating damage numbers. */
    headPosition(id) {
      const record = players.get(id);
      if (!record) return null;
      return {
        x: record.display.x,
        y: record.display.y - EYE_HEIGHT + 2.6,
        z: record.display.z
      };
    },

    /** 100ms red tint flash + positional pitched hurt audio on the victim. */
    damageFeedback(id, localEntity) {
      const record = players.get(id);
      if (!record || !record.alive) return;
      record.flashUntil = performance.now() + 100;
      const now = performance.now();
      if (localEntity && now - record.lastHurtAudioAt > 60) {
        record.lastHurtAudioAt = now;
        const dist = Math.hypot(
          record.display.x - localEntity.x,
          record.display.y - localEntity.y,
          record.display.z - localEntity.z
        );
        audio.playAt('hurt', dist, 18, 0.6, audio.hurtPitch());
      }
    },

    applySnapshot(p) {
      let record = players.get(p.id);
      if (!record) {
        this.upsert(p);
        record = players.get(p.id);
      }
      const aliveNext = p.alive !== false;
      if (record.alive && aliveNext && Number.isFinite(record.hp) && p.hp < record.hp - 0.001) {
        this.damageFeedback(p.id, localEntityRef);
      }
      record.alive = aliveNext;
      record.hp = p.hp;
      record.weapon = weaponOrDefault(p.weapon);
      record.buffer.push({
        at: performance.now(),
        state: {
          x: p.x, y: p.y, z: p.z,
          yaw: p.yaw || 0, pitch: p.pitch || 0,
          anim: p.anim || {}
        }
      });
      if (record.buffer.length > BUFFER_LIMIT) record.buffer.shift();
    },

    onRemoteFire(msg, localEntity) {
      const record = players.get(msg.id);
      const weapon = WEAPONS[weaponOrDefault(msg.weapon)];
      let from = { x: msg.ox, y: msg.oy, z: msg.oz };
      if (record && record.alive) {
        record.lastFireAt = performance.now();
        if (record.char && record.char.handWorldPosition(scratch)) {
          from = { x: scratch.x, y: scratch.y, z: scratch.z };
        }
      }
      effects.addMuzzleFlash(from, weapon.pellets > 1 ? 1.2 : 0.9);
      effects.addTracer(from, { x: msg.tx, y: msg.ty, z: msg.tz });
      effects.addImpact({ x: msg.tx, y: msg.ty, z: msg.tz });
      if (localEntity) {
        const dist = Math.hypot(msg.ox - localEntity.x, msg.oy - localEntity.y, msg.oz - localEntity.z);
        audio.playAt(weapon.sound, dist, 110, 0.7);
      }
    },

    onDeath(id) {
      const record = players.get(id);
      if (!record) return;
      record.alive = false;
      record.dying = DEATH_LINGER_SECONDS;
      record.buffer.length = 0;
      if (record.char) record.char.play('Death', 0.08);
      const pos = record.root.position;
      effects.addImpact({ x: pos.x, y: pos.y + 1.2, z: pos.z }, 0xc23b3b);
    },

    onRespawn(msg) {
      const record = players.get(msg.id);
      if (!record) return;
      record.alive = true;
      record.hp = msg.hp;
      record.dying = 0;
      record.root.visible = true;
      record.buffer.length = 0;
      record.display.x = msg.x;
      record.display.y = msg.y;
      record.display.z = msg.z;
      record.lastDisplay.x = msg.x;
      record.lastDisplay.y = msg.y;
      record.lastDisplay.z = msg.z;
      if (record.char) record.char.play('Idle', 0);
      placeAvatar(record);
    },

    alivePositions() {
      const out = [];
      for (const record of players.values()) {
        if (record.alive) out.push({ x: record.display.x, z: record.display.z });
      }
      return out;
    },

    /** Axis-aligned body/head hitboxes for hitscan tests. */
    targets() {
      const out = [];
      for (const record of players.values()) {
        if (!record.alive) continue;
        const feetX = record.display.x;
        const feetY = record.display.y - EYE_HEIGHT;
        const feetZ = record.display.z;
        out.push({
          id: record.id,
          body: {
            min: { x: feetX - 0.55, y: feetY, z: feetZ - 0.45 },
            max: { x: feetX + 0.55, y: feetY + 1.82, z: feetZ + 0.45 }
          },
          head: {
            min: { x: feetX - 0.36, y: feetY + 1.82, z: feetZ - 0.36 },
            max: { x: feetX + 0.36, y: feetY + 2.48, z: feetZ + 0.36 }
          }
        });
      }
      return out;
    },

    count() {
      return players.size;
    },

    debugInfo() {
      const out = [];
      for (const r of players.values()) {
        out.push({
          id: r.id,
          weapon: r.weapon,
          hasChar: !!r.char,
          animation: r.char ? r.char.currentAnimation() : null,
          rootPos: r.root.position.toArray().map((n) => +n.toFixed(2))
        });
      }
      return out;
    },

    update(dt, nowMs) {
      const renderAt = nowMs - INTERP_DELAY_MS;
      for (const record of players.values()) {
        applyDamageFlash(record, nowMs);
        if (!record.alive) {
          if (record.dying > 0) {
            record.dying -= dt;
            if (record.char) record.char.update(dt);
            if (record.dying <= 0) record.root.visible = false;
          }
          continue;
        }
        interpolate(record, renderAt);
        placeAvatar(record);

        const dx = record.display.x - record.lastDisplay.x;
        const dz = record.display.z - record.lastDisplay.z;
        const speed = Math.hypot(dx, dz) / Math.max(0.0001, dt);
        record.worldSpeed += (speed - record.worldSpeed) * Math.min(1, dt * 12);
        record.lastDisplay.x = record.display.x;
        record.lastDisplay.y = record.display.y;
        record.lastDisplay.z = record.display.z;

        if (record.char) {
          record.char.play(chooseAnimation(record, nowMs));
          record.char.setHeadPitch(-record.display.pitch * 0.8);
          record.char.update(dt);
        }
      }
      effects.update(dt);
    },

    effects
  };
}

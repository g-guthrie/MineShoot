/**
 * remotes.js - Other players, rendered with the classic blocky avatar rig
 * and interpolated between server snapshots.
 */
import { EYE_HEIGHT } from '../shared/entity-constants.js';
import { WEAPONS, weaponOrDefault } from '../shared/combat.js';
import { createEffects } from './effects.js';
import { audio } from './audio.js';

const THREE = globalThis.THREE;
const INTERP_DELAY_MS = 120;
const BUFFER_LIMIT = 30;

// Minecraft-ish skin palette; deterministic per player id.
const SKINS = [
  { body: 0x3aa655, leg: 0x365426 }, // creeper green
  { body: 0x4a7fc1, leg: 0x2d3a56 }, // steve blue
  { body: 0xc14a4a, leg: 0x4a2323 },
  { body: 0xc1a04a, leg: 0x564a23 },
  { body: 0x8e4ac1, leg: 0x3d2356 },
  { body: 0x4ac1b4, leg: 0x235650 },
  { body: 0xd4742c, leg: 0x5e3413 },
  { body: 0x97a2ad, leg: 0x3d4248 }
];

function skinFor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return SKINS[Math.abs(hash) % SKINS.length];
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
  const GameAvatarRig = globalThis.__MAYHEM_RUNTIME.GameAvatarRig;
  const effects = createEffects(scene);
  const players = new Map(); // id -> remote record

  function createRecord(p) {
    const skin = skinFor(p.id);
    const avatar = GameAvatarRig.create({
      bodyColor: skin.body,
      legColor: skin.leg
    });
    avatar.root.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
      }
    });
    avatar.setWeapon(weaponOrDefault(p.weapon));

    const nameSprite = makeNameSprite(p.name || '?');
    nameSprite.position.set(0, 3.15, 0);
    avatar.root.add(nameSprite);

    scene.add(avatar.root);

    const record = {
      id: p.id,
      name: p.name || '?',
      avatar,
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
      worldSpeed: 0
    };
    avatar.root.visible = record.alive;
    placeAvatar(record);
    return record;
  }

  function placeAvatar(record) {
    const d = record.display;
    record.avatar.root.position.set(d.x, d.y - EYE_HEIGHT, d.z);
    record.avatar.root.rotation.y = d.yaw;
  }

  function interpolate(record, renderAtMs) {
    const buffer = record.buffer;
    if (buffer.length === 0) return;
    if (buffer.length === 1 || renderAtMs <= buffer[0].at) {
      Object.assign(record.display, buffer[buffer.length - 1].state);
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

  return {
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
      scene.remove(record.avatar.root);
      record.avatar.dispose();
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

    applySnapshot(p) {
      let record = players.get(p.id);
      if (!record) {
        this.upsert(p);
        record = players.get(p.id);
      }
      record.alive = p.alive !== false;
      record.hp = p.hp;
      const weapon = weaponOrDefault(p.weapon);
      if (weapon !== record.weapon) {
        record.weapon = weapon;
        record.avatar.setWeapon(weapon);
      }
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
        record.avatar.triggerAction('fire', { duration: 0.12 });
        const muzzle = record.avatar.getMuzzleWorldPosition();
        if (muzzle) from = { x: muzzle.x, y: muzzle.y, z: muzzle.z };
      }
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
      record.avatar.root.visible = false;
      record.buffer.length = 0;
      const pos = record.avatar.root.position;
      effects.addImpact({ x: pos.x, y: pos.y + 1.2, z: pos.z }, 0xc23b3b);
    },

    onRespawn(msg) {
      const record = players.get(msg.id);
      if (!record) return;
      record.alive = true;
      record.hp = msg.hp;
      record.avatar.root.visible = true;
      record.buffer.length = 0;
      record.display.x = msg.x;
      record.display.y = msg.y;
      record.display.z = msg.z;
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

    update(dt, nowMs) {
      const renderAt = nowMs - INTERP_DELAY_MS;
      for (const record of players.values()) {
        if (!record.alive) continue;
        interpolate(record, renderAt);
        placeAvatar(record);

        const dx = record.display.x - record.lastDisplay.x;
        const dz = record.display.z - record.lastDisplay.z;
        const speed = Math.hypot(dx, dz) / Math.max(0.0001, dt);
        record.worldSpeed += (speed - record.worldSpeed) * Math.min(1, dt * 12);
        record.lastDisplay.x = record.display.x;
        record.lastDisplay.y = record.display.y;
        record.lastDisplay.z = record.display.z;

        const anim = record.display.anim || {};
        record.avatar.updateAnimation(dt, {
          speedNorm: Math.min(1.4, record.worldSpeed / 14),
          worldSpeed: record.worldSpeed,
          sprinting: !!anim.sprinting,
          airborne: !!anim.airborne,
          movingForward: !!anim.movingForward,
          movingBackward: !!anim.movingBackward,
          reloading: !!anim.reloading,
          aimPitch: record.display.pitch
        });
      }
      effects.update(dt);
    },

    effects
  };
}

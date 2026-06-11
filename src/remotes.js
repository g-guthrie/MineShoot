/**
 * remotes.js - Other players, rendered with the classic blocky avatar rig
 * and interpolated between server snapshots.
 */
import { EYE_HEIGHT } from '../shared/entity-constants.js';
import { WEAPONS, weaponOrDefault } from '../shared/combat.js';
import { createEffects } from './effects.js';
import { createGunModel } from './gun-models.js';
import { audio } from './audio.js';

const THREE = globalThis.THREE;
const INTERP_DELAY_MS = 100;
const EXTRAPOLATION_MS = 120;
const BUFFER_LIMIT = 40;
const DEATH_FALL_SECONDS = 0.85;

// How long each weapon should be in an avatar's hands, in world units
// (the avatar is ~2.5 units tall, so a rifle spans roughly half its height,
// like Minecraft gun mods).
const AVATAR_GUN_LENGTH = {
  machinegun: 1.05,
  shotgun: 1.0,
  sniper: 1.3,
  pistol: 0.5
};

const PROCEDURAL_GUN_PARTS = ['gunBody', 'gunBarrel', 'gunStock', 'gunGrip', 'scope', 'pump', 'coil'];

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
  let localEntityRef = null;

  /**
   * Replaces the rig's procedural box gun with the real textured model,
   * grip-aligned to the hand mount.
   */
  function attachGunModel(record, weaponId) {
    const rig = record.avatar.rig;
    for (const part of PROCEDURAL_GUN_PARTS) {
      if (rig[part]) rig[part].visible = false;
    }
    const token = (record.gunToken = (record.gunToken || 0) + 1);
    createGunModel(weaponId, AVATAR_GUN_LENGTH[weaponId] || 1, 0.75).then((model) => {
      if (record.gunToken !== token || record.removed) return;
      if (record.gunModel) rig.gun.remove(record.gunModel);
      // Seat the grip into the palm rather than floating at the mount origin.
      model.position.set(0, -0.03, 0.08);
      record.gunModel = model;
      rig.gun.add(model);
    }).catch(() => {});
  }

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

    const rig = avatar.rig;
    const record = {
      id: p.id,
      name: p.name || '?',
      avatar,
      flashMaterials: [
        rig.bodyMesh.material,
        rig.headMesh.material,
        rig.armLMesh.material,
        rig.legLMesh.material
      ],
      flashUntil: 0,
      flashActive: false,
      lastHurtAudioAt: 0,
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
      lateralLean: 0,
      wasAirborne: false,
      landSquash: 0,
      dying: 0,
      gunModel: null,
      gunToken: 0,
      removed: false
    };
    avatar.root.visible = record.alive;
    attachGunModel(record, record.weapon);
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
    const shouldFlash = nowMs < record.flashUntil;
    if (shouldFlash === record.flashActive) return;
    record.flashActive = shouldFlash;
    for (const material of record.flashMaterials) {
      material.emissive.setHex(shouldFlash ? 0x9b1f1f : 0x000000);
    }
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
      const weapon = weaponOrDefault(p.weapon);
      if (weapon !== record.weapon) {
        record.weapon = weapon;
        record.avatar.setWeapon(weapon);
        attachGunModel(record, weapon);
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
      record.dying = DEATH_FALL_SECONDS;
      record.buffer.length = 0;
      const pos = record.avatar.root.position;
      effects.addImpact({ x: pos.x, y: pos.y + 1.2, z: pos.z }, 0xc23b3b);
    },

    onRespawn(msg) {
      const record = players.get(msg.id);
      if (!record) return;
      record.alive = true;
      record.hp = msg.hp;
      record.dying = 0;
      record.avatar.root.visible = true;
      record.avatar.root.rotation.z = 0;
      record.buffer.length = 0;
      record.display.x = msg.x;
      record.display.y = msg.y;
      record.display.z = msg.z;
      record.lastDisplay.x = msg.x;
      record.lastDisplay.y = msg.y;
      record.lastDisplay.z = msg.z;
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
      const v = new THREE.Vector3();
      for (const r of players.values()) {
        r.avatar.rig.gun.getWorldPosition(v);
        out.push({
          id: r.id,
          weapon: r.weapon,
          hasGunModel: !!r.gunModel,
          gunScale: r.gunModel ? +r.gunModel.scale.x.toFixed(3) : 0,
          gunWorld: v.toArray().map((n) => +n.toFixed(2)),
          rootPos: r.avatar.root.position.toArray().map((n) => +n.toFixed(2)),
          gunRot: ['x', 'y', 'z'].map((ax) => +r.avatar.rig.gun.rotation[ax].toFixed(2))
        });
      }
      return out;
    },

    update(dt, nowMs) {
      const renderAt = nowMs - INTERP_DELAY_MS;
      for (const record of players.values()) {
        applyDamageFlash(record, nowMs);
        if (!record.alive) {
          // Minecraft-style death: tip over sideways, then disappear.
          if (record.dying > 0) {
            record.dying -= dt;
            const progress = 1 - Math.max(0, record.dying) / DEATH_FALL_SECONDS;
            record.avatar.root.rotation.z = (Math.PI / 2) * Math.min(1, progress * 1.6);
            if (record.dying <= 0) record.avatar.root.visible = false;
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

        const anim = record.display.anim || {};

        // Jump anticipation pose on takeoff, squash-and-stretch on landing.
        const airborne = !!anim.airborne;
        if (airborne && !record.wasAirborne) {
          record.avatar.triggerAction('jump', { duration: 0.22 });
        } else if (!airborne && record.wasAirborne) {
          record.landSquash = 1;
        }
        record.wasAirborne = airborne;
        record.landSquash = Math.max(0, record.landSquash - dt * 6);
        const squash = Math.sin(record.landSquash * Math.PI) * 0.12;
        const stretch = airborne ? 0.05 : 0;
        record.avatar.root.scale.set(1 + squash * 0.6, 1 - squash + stretch, 1 + squash * 0.6);

        // Lean into strafes: lateral velocity in the avatar's facing frame.
        const yaw = record.display.yaw;
        const lateral = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(0.0001, dt);
        const targetLean = Math.max(-0.12, Math.min(0.12, -lateral * 0.012));
        record.lateralLean += (targetLean - record.lateralLean) * Math.min(1, dt * 8);
        if (record.alive) record.avatar.root.rotation.z = record.lateralLean;

        record.avatar.updateAnimation(dt, {
          speedNorm: Math.min(1.4, record.worldSpeed / 14),
          worldSpeed: record.worldSpeed,
          sprinting: !!anim.sprinting,
          airborne,
          movingForward: !!anim.movingForward,
          movingBackward: !!anim.movingBackward,
          reloading: !!anim.reloading,
          adsActive: !!anim.ads,
          aimPitch: record.display.pitch
        });
        // Head follows the player's look pitch, like Minecraft.
        record.avatar.rig.headMesh.rotation.x = -record.display.pitch * 0.85;
      }
      effects.update(dt);
    },

    effects
  };
}

import { BOT, PLAYER, SNAPSHOT_HZ, WEAPONS } from '../shared/constants.js';
import { distanceSq2, normalizeYaw } from '../shared/math.js';
import { createPlayerState, normalizeInput, respawnPlayer, stepPlayer } from '../shared/movement.js';
import { MSG } from '../shared/protocol.js';
import { resolveFire } from '../shared/combat.js';
import { chooseSpawn, createWorld } from '../shared/world.js';

function serializeEntity(entity) {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    x: Number(entity.x || 0),
    y: Number(entity.y || PLAYER.eyeHeight),
    z: Number(entity.z || 0),
    vx: Number(entity.vx || 0),
    vy: Number(entity.vy || 0),
    vz: Number(entity.vz || 0),
    yaw: Number(entity.yaw || 0),
    pitch: Number(entity.pitch || 0),
    grounded: entity.grounded !== false,
    health: Math.max(0, Number(entity.health || 0)),
    alive: !!entity.alive,
    kills: Number(entity.kills || 0),
    deaths: Number(entity.deaths || 0),
    weaponId: entity.weaponId || 'rifle'
  };
}

function makeBotInput(bot, target, nowMs) {
  if (!target) {
    return normalizeInput({
      yaw: bot.yaw + 0.01,
      pitch: 0,
      forward: true
    });
  }
  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const yaw = normalizeYaw(Math.atan2(-dx, -dz));
  const distSq = (dx * dx) + (dz * dz);
  const strafe = ((bot.botSeed + Math.floor(nowMs / 1200)) % 3) === 0;
  return normalizeInput({
    yaw,
    pitch: 0,
    forward: distSq > 220,
    backward: distSq < 80,
    left: strafe,
    right: !strafe && distSq < 900,
    sprint: distSq > 400
  });
}

export class V2Room {
  constructor(options = {}) {
    this.world = options.world || createWorld();
    this.entities = new Map();
    this.clients = new Map();
    this.eventLog = [];
    this.nextEventSeq = 1;
    this.nextSnapshotSeq = 1;
    this.nowMs = 0;
    this.snapshotIntervalMs = 1000 / SNAPSHOT_HZ;
    this.spawnSeq = 0;
    this.addBots(Math.max(0, Number(options.botCount ?? BOT.count)));
  }

  addEvent(event) {
    if (!event) return;
    this.eventLog.push({
      seq: this.nextEventSeq++,
      at: this.nowMs,
      ...event
    });
    if (this.eventLog.length > 96) this.eventLog.shift();
  }

  addBots(count) {
    for (let i = 0; i < count; i++) {
      const id = `bot-${i + 1}`;
      const bot = createPlayerState({
        id,
        name: `Bot ${i + 1}`,
        kind: 'bot',
        spawn: chooseSpawn(this.world, i + 1)
      });
      bot.botSeed = i + 11;
      bot.weaponId = i % 3 === 0 ? 'shotgun' : 'rifle';
      this.entities.set(id, bot);
    }
  }

  connect(clientId, name = 'Player') {
    const id = String(clientId || 'player');
    const player = createPlayerState({
      id,
      name,
      kind: 'human',
      spawn: chooseSpawn(this.world, this.spawnSeq++)
    });
    this.entities.set(id, player);
    this.clients.set(id, {
      id,
      lastInput: normalizeInput({ yaw: player.yaw }),
      lastEventSeq: 0
    });
    return {
      t: MSG.WELCOME,
      selfId: id,
      roomId: 'v2-local',
      world: this.world,
      weapons: WEAPONS,
      snapshotHz: SNAPSHOT_HZ
    };
  }

  disconnect(clientId) {
    const id = String(clientId || '');
    this.clients.delete(id);
    this.entities.delete(id);
  }

  receive(clientId, msg) {
    const id = String(clientId || '');
    const client = this.clients.get(id);
    const player = this.entities.get(id);
    if (!client || !player || !msg || !msg.t) return null;
    if (msg.t === MSG.INPUT) {
      client.lastInput = normalizeInput(msg.input || {});
      return null;
    }
    if (msg.t === MSG.EQUIP) {
      if (WEAPONS[msg.weaponId]) player.weaponId = msg.weaponId;
      return null;
    }
    if (msg.t === MSG.FIRE) {
      const event = resolveFire(this, player, msg, this.nowMs);
      this.addEvent(event);
      return event;
    }
    return null;
  }

  findTargetFor(entity) {
    let best = null;
    let bestDistSq = Infinity;
    for (const candidate of this.entities.values()) {
      if (!candidate || candidate.id === entity.id || !candidate.alive) continue;
      const distSq = distanceSq2(entity, candidate);
      if (distSq < bestDistSq) {
        best = candidate;
        bestDistSq = distSq;
      }
    }
    return best;
  }

  stepBots(dtMs) {
    for (const entity of this.entities.values()) {
      if (!entity || entity.kind !== 'bot' || !entity.alive) continue;
      const target = this.findTargetFor(entity);
      const input = makeBotInput(entity, target, this.nowMs);
      stepPlayer(entity, input, dtMs / 1000, this.world);
      if (!target || !target.alive) continue;
      const distSq = distanceSq2(entity, target);
      if (distSq <= BOT.fireRange * BOT.fireRange) {
        const event = resolveFire(this, entity, {
          weaponId: entity.weaponId,
          shotId: this.nowMs + entity.botSeed,
          yaw: input.yaw,
          pitch: input.pitch
        }, this.nowMs);
        if (event && event.type === 'shot') this.addEvent(event);
      }
    }
  }

  step(dtMs) {
    const dt = Math.max(0, Math.min(50, Number(dtMs || 0)));
    this.nowMs += dt;
    for (const entity of this.entities.values()) {
      if (!entity) continue;
      if (!entity.alive) {
        if (entity.respawnAt > 0 && this.nowMs >= entity.respawnAt) {
          respawnPlayer(entity, this.world, ++this.spawnSeq, this.nowMs);
          this.addEvent({ type: 'respawn', entityId: entity.id });
        }
        continue;
      }
      if (entity.kind === 'human') {
        const client = this.clients.get(entity.id);
        stepPlayer(entity, client ? client.lastInput : {}, dt / 1000, this.world);
      }
    }
    this.stepBots(dt);
  }

  snapshotFor(clientId) {
    const id = String(clientId || '');
    const client = this.clients.get(id);
    const lastEventSeq = client ? Number(client.lastEventSeq || 0) : 0;
    const events = this.eventLog.filter((event) => Number(event.seq || 0) > lastEventSeq);
    if (client && events.length) {
      client.lastEventSeq = Number(events[events.length - 1].seq || client.lastEventSeq || 0);
    }
    return {
      t: MSG.SNAPSHOT,
      snapshotSeq: this.nextSnapshotSeq++,
      serverTime: this.nowMs,
      selfId: id,
      entities: Array.from(this.entities.values()).map(serializeEntity),
      events
    };
  }
}

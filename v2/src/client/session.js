import { WEAPONS } from '../shared/constants.js';
import { clonePlayerState, stepPlayer } from '../shared/movement.js';
import { MSG } from '../shared/protocol.js';
import { LocalAuthoritativeTransport } from '../net/local-transport.js';
import { InputController } from './input.js';
import { Renderer } from './renderer.js';
import { Hud } from './hud.js';
import { AudioBus } from './audio.js';

function entityById(snapshot, id) {
  return snapshot && Array.isArray(snapshot.entities)
    ? snapshot.entities.find((entity) => entity.id === id)
    : null;
}

export class GameSession {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new InputController(canvas);
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(document);
    this.audio = new AudioBus();
    this.transport = new LocalAuthoritativeTransport({ botCount: 5 });
    this.selfId = '';
    this.world = null;
    this.latestSnapshot = null;
    this.predictedSelf = null;
    this.lastFrameAt = performance.now();
    this.running = false;
    this.transport.onmessage = (message) => this.handleMessage(message);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.hud.hideStart();
    this.transport.connect();
    this.lastFrameAt = performance.now();
    requestAnimationFrame((now) => this.frame(now));
  }

  handleMessage(message) {
    if (!message || !message.t) return;
    if (message.t === MSG.WELCOME) {
      this.selfId = message.selfId;
      this.world = message.world;
      this.renderer.buildWorld(this.world);
      return;
    }
    if (message.t === MSG.SNAPSHOT) {
      this.latestSnapshot = message;
      const serverSelf = entityById(message, this.selfId);
      if (serverSelf) {
        if (!this.predictedSelf || !this.predictedSelf.alive || !serverSelf.alive) {
          this.predictedSelf = clonePlayerState(serverSelf);
        } else {
          const dx = serverSelf.x - this.predictedSelf.x;
          const dz = serverSelf.z - this.predictedSelf.z;
          const errorSq = (dx * dx) + (dz * dz);
          const correction = errorSq > 4 ? 1 : 0.18;
          this.predictedSelf.x += dx * correction;
          this.predictedSelf.y += (serverSelf.y - this.predictedSelf.y) * correction;
          this.predictedSelf.z += dz * correction;
          this.predictedSelf.health = serverSelf.health;
          this.predictedSelf.alive = serverSelf.alive;
          this.predictedSelf.kills = serverSelf.kills;
          this.predictedSelf.deaths = serverSelf.deaths;
          this.predictedSelf.weaponId = serverSelf.weaponId;
        }
      }
      this.renderer.applySnapshot(message, this.selfId);
      this.hud.update(message, this.selfId);
      this.handleEvents(message.events || []);
    }
  }

  handleEvents(events) {
    for (const event of events) {
      if (!event || !event.type) continue;
      if (event.type === 'shot') {
        this.audio.playWeapon(event.weaponId);
        if (event.shooterId === this.selfId && Array.isArray(event.hits) && event.hits.length) {
          this.hud.flashHitmarker();
        }
        for (const hit of event.hits || []) {
          if (hit.killed) {
            this.hud.pushFeed(`${event.shooterId} eliminated ${hit.targetId}`);
          }
        }
      } else if (event.type === 'respawn') {
        this.hud.pushFeed(`${event.entityId} respawned`);
      }
    }
  }

  frame(now) {
    if (!this.running) return;
    const dtMs = Math.min(50, Math.max(0, now - this.lastFrameAt));
    this.lastFrameAt = now;
    const { input, messages } = this.input.drainMessages();
    for (const message of messages) {
      this.transport.send(message);
    }
    if (this.predictedSelf && this.predictedSelf.alive && this.world) {
      this.predictedSelf.weaponId = WEAPONS[this.input.weaponId] ? this.input.weaponId : this.predictedSelf.weaponId;
      stepPlayer(this.predictedSelf, input, dtMs / 1000, this.world);
    }
    this.transport.step(dtMs);
    this.renderer.update(dtMs / 1000, this.predictedSelf);
    requestAnimationFrame((next) => this.frame(next));
  }
}


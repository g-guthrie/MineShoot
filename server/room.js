/**
 * room.js - GlobalArenaRoom Durable Object.
 *
 * One instance per arena. Holds live player state, the placed-block grid,
 * and the score table. Movement is client-simulated and relayed; combat is
 * validated here (fire-rate, range, sanity checks) so health and kills stay
 * server-authoritative.
 */
import {
  WEAPONS,
  BLOCKS,
  PLAYER_MAX_HP,
  RESPAWN_DELAY_MS,
  SNAPSHOT_HZ,
  weaponOrDefault,
  sanitizePlayerName,
  parseBlockKey,
  blockKey
} from '../shared/combat.js';
import { ARENA } from '../shared/combat.js';

const WORLD_MIN = ARENA.min - 4;
const WORLD_MAX = ARENA.max + 4;
const MAX_PLAYERS = 24;
const MAX_BLOCKS_TOTAL = 1200;
const HIT_RANGE_SLACK = 8;
const MATCH_MS = 5 * 60 * 1000;
const INTERMISSION_MS = 9000;

function now() {
  return Date.now();
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export class GlobalArenaRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = new Map(); // id -> player record
    this.blocks = new Map();  // "ix,iy,iz" -> { hp, by }
    this.nextId = 1;
    this.snapshotTimer = null;
    this.matchEndsAt = 0;
    this.intermissionUntil = 0;
    this.matchActive = true;
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    if (this.players.size >= MAX_PLAYERS) {
      return new Response('Room full', { status: 503 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const id = 'p' + this.nextId++;
    const player = {
      id,
      ws: server,
      name: 'Player',
      joined: false,
      alive: false,
      hp: PLAYER_MAX_HP,
      kills: 0,
      deaths: 0,
      x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
      weapon: weaponOrDefault(null),
      anim: {},
      blocksCarried: BLOCKS.startCarried,
      lastBlockRegenAt: now(),
      lastFireAt: 0,
      diedAt: 0,
      lastSeenAt: now()
    };
    this.players.set(id, player);

    server.addEventListener('message', (event) => {
      this.onMessage(player, event.data);
    });
    const drop = () => this.removePlayer(id);
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);

    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(player, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;
    player.lastSeenAt = now();

    switch (msg.t) {
      case 'join': return this.handleJoin(player, msg);
      case 'state': return this.handleState(player, msg);
      case 'fire': return this.handleFire(player, msg);
      case 'hit': return this.handleHit(player, msg);
      case 'place': return this.handlePlace(player, msg);
      case 'block_hit': return this.handleBlockHit(player, msg);
      case 'respawn': return this.handleRespawn(player, msg);
      case 'ping': return this.sendTo(player, { t: 'pong', now: msg.now });
    }
  }

  handleJoin(player, msg) {
    if (player.joined) return;
    player.joined = true;
    if (!this.matchEndsAt) this.matchEndsAt = now() + MATCH_MS;
    player.name = sanitizePlayerName(msg.name);
    player.alive = true;
    player.hp = PLAYER_MAX_HP;
    this.applyReportedPosition(player, msg);

    this.sendTo(player, {
      t: 'welcome',
      id: player.id,
      players: this.publicPlayers(),
      blocks: Array.from(this.blocks.keys()).map((key) => ({
        k: key,
        hp: this.blocks.get(key).hp
      })),
      scores: this.scoreTable()
    });
    this.broadcast({ t: 'join', player: this.publicPlayer(player) }, player.id);
    this.ensureSnapshotLoop();
  }

  handleState(player, msg) {
    if (!player.joined || !player.alive) return;
    this.applyReportedPosition(player, msg);
    player.weapon = weaponOrDefault(msg.weapon);
    player.anim = (msg.anim && typeof msg.anim === 'object') ? msg.anim : {};
    this.regenBlocks(player);
  }

  applyReportedPosition(player, msg) {
    player.x = clampNum(msg.x, WORLD_MIN, WORLD_MAX, player.x);
    player.y = clampNum(msg.y, -20, 300, player.y);
    player.z = clampNum(msg.z, WORLD_MIN, WORLD_MAX, player.z);
    player.yaw = clampNum(msg.yaw, -Math.PI * 2, Math.PI * 2, player.yaw);
    player.pitch = clampNum(msg.pitch, -1.6, 1.6, player.pitch);
  }

  // Fire events are broadcast for tracers/sound on other clients. The
  // cooldown stamp recorded here also gates how often hits are accepted.
  handleFire(player, msg) {
    if (!player.joined || !player.alive || !this.matchActive) return;
    const weapon = WEAPONS[weaponOrDefault(msg.weapon)];
    const elapsed = now() - player.lastFireAt;
    if (elapsed < weapon.cooldownMs * 0.7) return;
    player.lastFireAt = now();
    this.broadcast({
      t: 'fire',
      id: player.id,
      weapon: weaponOrDefault(msg.weapon),
      ox: clampNum(msg.ox, WORLD_MIN, WORLD_MAX, player.x),
      oy: clampNum(msg.oy, -20, 300, player.y),
      oz: clampNum(msg.oz, WORLD_MIN, WORLD_MAX, player.z),
      tx: Number(msg.tx) || 0,
      ty: Number(msg.ty) || 0,
      tz: Number(msg.tz) || 0
    }, player.id);
  }

  handleHit(player, msg) {
    if (!player.joined || !player.alive || !this.matchActive) return;
    const target = this.players.get(String(msg.target || ''));
    if (!target || !target.joined || !target.alive || target.id === player.id) return;

    const weaponId = weaponOrDefault(msg.weapon);
    const weapon = WEAPONS[weaponId];

    // Range sanity: shooter and victim must actually be near each other.
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dz = target.z - player.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > weapon.range + HIT_RANGE_SLACK) return;

    const pellets = Math.min(weapon.pellets, Math.max(1, Number(msg.pellets) | 0));
    const headshot = !!msg.head && weapon.pellets === 1;
    let damage = weapon.damage * pellets;
    if (headshot) damage = Math.round(damage * weapon.headshotMult);

    target.hp = Math.max(0, target.hp - damage);
    this.sendTo(target, { t: 'damage', hp: target.hp, from: player.id, amount: damage });
    this.sendTo(player, { t: 'hit_confirm', target: target.id, amount: damage, head: headshot, hp: target.hp });

    if (target.hp <= 0) {
      target.alive = false;
      target.diedAt = now();
      target.deaths += 1;
      player.kills += 1;
      this.broadcast({
        t: 'death',
        id: target.id,
        by: player.id,
        weapon: weaponId,
        head: headshot,
        scores: this.scoreTable()
      });
    }
  }

  handlePlace(player, msg) {
    if (!player.joined || !player.alive || !this.matchActive) return;
    this.regenBlocks(player);
    if (player.blocksCarried <= 0) return;
    if (this.blocks.size >= MAX_BLOCKS_TOTAL) return;

    const { ix, iy, iz } = parseBlockKey(msg.k);
    const key = blockKey(ix, iy, iz);
    if (this.blocks.has(key)) return;
    const cx = (ix + 0.5) * BLOCKS.size;
    const cz = (iz + 0.5) * BLOCKS.size;
    const cy = (iy + 0.5) * BLOCKS.size;
    if (cx < WORLD_MIN || cx > WORLD_MAX || cz < WORLD_MIN || cz > WORLD_MAX) return;
    if (cy < -10 || cy > 120) return;
    const reach = Math.hypot(cx - player.x, cy - player.y, cz - player.z);
    if (reach > BLOCKS.placeRange + HIT_RANGE_SLACK) return;

    player.blocksCarried -= 1;
    this.blocks.set(key, { hp: BLOCKS.hp, by: player.id });
    this.sendTo(player, { t: 'block_count', count: player.blocksCarried });
    this.broadcast({ t: 'block_add', k: key, by: player.id });
  }

  handleBlockHit(player, msg) {
    if (!player.joined || !player.alive) return;
    const key = String(msg.k || '');
    const block = this.blocks.get(key);
    if (!block) return;
    block.hp -= 1;
    if (block.hp <= 0) {
      this.blocks.delete(key);
      this.broadcast({ t: 'block_remove', k: key });
    } else {
      this.broadcast({ t: 'block_damage', k: key, hp: block.hp });
    }
  }

  handleRespawn(player, msg) {
    if (!player.joined || player.alive) return;
    if (now() - player.diedAt < RESPAWN_DELAY_MS - 250) return;
    player.alive = true;
    player.hp = PLAYER_MAX_HP;
    player.blocksCarried = Math.max(player.blocksCarried, BLOCKS.startCarried);
    this.applyReportedPosition(player, msg);
    this.broadcast({
      t: 'respawn',
      id: player.id,
      x: player.x, y: player.y, z: player.z,
      hp: player.hp
    });
    this.sendTo(player, { t: 'block_count', count: player.blocksCarried });
  }

  regenBlocks(player) {
    const elapsed = now() - player.lastBlockRegenAt;
    if (elapsed < BLOCKS.regenMs) return;
    const gained = Math.floor(elapsed / BLOCKS.regenMs);
    player.lastBlockRegenAt += gained * BLOCKS.regenMs;
    const before = player.blocksCarried;
    player.blocksCarried = Math.min(BLOCKS.maxCarried, player.blocksCarried + gained);
    if (player.blocksCarried !== before) {
      this.sendTo(player, { t: 'block_count', count: player.blocksCarried });
    }
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);
    try { player.ws.close(); } catch (err) { /* already closed */ }
    if (player.joined) {
      this.broadcast({ t: 'leave', id });
    }
    if (this.players.size === 0 && this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  ensureSnapshotLoop() {
    if (this.snapshotTimer) return;
    this.snapshotTimer = setInterval(() => {
      if (this.players.size === 0) return;
      // Abrupt disconnects don't always fire a close event, so kick anyone
      // who has gone silent (live clients send state at 20Hz).
      const cutoff = now() - 15000;
      for (const player of Array.from(this.players.values())) {
        if (player.joined && player.lastSeenAt < cutoff) {
          this.removePlayer(player.id);
        }
      }
      this.tickMatch();
      this.broadcast({
        t: 'snap',
        players: this.publicPlayers(),
        matchMs: this.matchActive ? Math.max(0, this.matchEndsAt - now()) : 0
      });
    }, Math.round(1000 / SNAPSHOT_HZ));
  }

  tickMatch() {
    const t = now();
    if (this.matchActive && this.matchEndsAt && t >= this.matchEndsAt) {
      this.matchActive = false;
      this.intermissionUntil = t + INTERMISSION_MS;
      this.broadcast({ t: 'match_end', scores: this.scoreTable(), nextInMs: INTERMISSION_MS });
    } else if (!this.matchActive && t >= this.intermissionUntil) {
      this.matchActive = true;
      this.matchEndsAt = t + MATCH_MS;
      this.blocks.clear();
      for (const player of this.players.values()) {
        player.kills = 0;
        player.deaths = 0;
        player.hp = PLAYER_MAX_HP;
        player.alive = true;
        player.blocksCarried = BLOCKS.startCarried;
      }
      this.broadcast({ t: 'match_start', scores: this.scoreTable() });
    }
  }

  publicPlayer(player) {
    return {
      id: player.id,
      name: player.name,
      x: player.x, y: player.y, z: player.z,
      yaw: player.yaw, pitch: player.pitch,
      weapon: player.weapon,
      anim: player.anim,
      hp: player.hp,
      alive: player.alive,
      kills: player.kills,
      deaths: player.deaths
    };
  }

  publicPlayers() {
    const list = [];
    for (const player of this.players.values()) {
      if (player.joined) list.push(this.publicPlayer(player));
    }
    return list;
  }

  scoreTable() {
    return this.publicPlayers()
      .map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths }))
      .sort((a, b) => b.kills - a.kills);
  }

  // READY_STATE_OPEN === 1; sockets that died without a close event would
  // otherwise raise async "network connection lost" errors on send.
  socketOpen(player) {
    return player.ws.readyState === 1;
  }

  sendTo(player, msg) {
    if (!this.socketOpen(player)) {
      this.removePlayer(player.id);
      return;
    }
    try {
      player.ws.send(JSON.stringify(msg));
    } catch (err) {
      this.removePlayer(player.id);
    }
  }

  broadcast(msg, exceptId) {
    const data = JSON.stringify(msg);
    for (const player of Array.from(this.players.values())) {
      if (!player.joined || player.id === exceptId) continue;
      if (!this.socketOpen(player)) {
        this.removePlayer(player.id);
        continue;
      }
      try {
        player.ws.send(data);
      } catch (err) {
        this.removePlayer(player.id);
      }
    }
  }
}

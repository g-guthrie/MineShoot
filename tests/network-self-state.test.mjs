import test from 'node:test';
import assert from 'node:assert/strict';

import { createSelfAuthoritativeChannel } from '../js/runtime/net/self-authoritative-channel.mjs';
import { createRemoteEntityChannel } from '../js/runtime/net/remote-entity-channel.mjs';
import { createClientNetRuntime } from '../js/runtime/net/client-net-runtime.mjs';

const protocol = {
  defaults: {
    roomId: 'global'
  },
  world: {
    profileVersion: 6,
    seedPrefix: 'room-env-v6-static',
    flags: {
      envV2: true,
      terrainPhysicsV2: true
    }
  },
  msg: {
    c2s: {
      JOIN_ROOM: 'join_room',
      INPUT: 'input',
      FIRE: 'fire'
    },
    s2c: {
      WELCOME: 'welcome',
      SNAPSHOT: 'snapshot',
      DAMAGE_EVENT: 'damage_event',
      DEATH_RESPAWN: 'death_respawn',
      ERROR: 'error'
    }
  },
  sanitizeRoomId(raw) {
    let id = String(raw || '').toLowerCase().trim();
    id = id.replace(/[^a-z0-9-]/g, '');
    if (!id) return 'global';
    if (id.length > 32) id = id.slice(0, 32);
    return id;
  }
};

function normalize(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createHarness() {
  let clock = 1000;
  let hooks = null;
  const sent = [];
  const remoteEvents = {
    upserts: [],
    removes: []
  };

  const transportFactory = {
    create(options) {
      hooks = options;
      return {
        connect() {
          options.onOpen();
        },
        send(message) {
          sent.push(normalize(message));
          return true;
        },
        shutdown() {}
      };
    }
  };

  const selfChannel = createSelfAuthoritativeChannel({
    nowMs: () => clock,
    createPreviewState(selfId) {
      if (!selfId) return null;
      return {
        id: String(selfId),
        username: 'PLAYER',
        classId: 'ffa',
        wallhackRadius: 90,
        kills: 0,
        deaths: 0,
        progressScore: 0,
        teamId: ''
      };
    }
  });

  const remoteChannel = createRemoteEntityChannel({
    onEntityUpsert(entity) {
      remoteEvents.upserts.push(normalize(entity));
    },
    onEntityRemove(entityId) {
      remoteEvents.removes.push(String(entityId));
    }
  });

  const runtime = createClientNetRuntime({
    protocol,
    roomId: 'global',
    transportFactory,
    selfChannel,
    remoteChannel,
    nowMs: () => clock,
    resolveEndpoint(roomId) {
      return `wss://play.example.com/api/ws?room=${roomId}`;
    }
  });

  runtime.init();

  return {
    runtime,
    sent,
    remoteEvents,
    setNow(value) {
      clock = Number(value);
    },
    dispatch(message) {
      hooks.onMessage(JSON.stringify(message));
    }
  };
}

test('client net runtime keeps self state empty until welcome and snapshots arrive', () => {
  const { runtime, sent } = createHarness();

  assert.equal(sent[0].t, 'join_room');
  assert.equal(runtime.hasAuthoritativeSelfState(), false);
  assert.equal(runtime.getAuthoritativeSelfState(), null);
  assert.equal(runtime.getSelfPreviewState(), null);
});

test('client net runtime routes self and remote snapshot lanes separately', () => {
  const { runtime, dispatch, remoteEvents } = createHarness();

  dispatch({
    t: 'welcome',
    selfId: 'user-1',
    roomId: 'ffa-01',
    gameMode: 'ffa'
  });
  dispatch({
    t: 'snapshot',
    gameMode: 'ffa',
    entities: [
      {
        id: 'user-1',
        username: 'PlayerOne',
        classId: 'ffa',
        x: 12,
        y: 1.6,
        z: 24,
        yaw: 0.2,
        pitch: 0.1,
        weaponId: 'rifle',
        moveSpeedNorm: 0.5,
        sprinting: false,
        hp: 420,
        hpMax: 500,
        armor: 55,
        armorMax: 90,
        kills: 3,
        deaths: 1,
        progressScore: 3,
        teamId: '',
        wallhackRadius: 88,
        alive: true,
        spawnShieldUntil: 0
      },
      {
        id: 'enemy-7',
        username: 'EnemySeven',
        classId: 'ffa',
        x: 20,
        y: 1.6,
        z: 30,
        yaw: 0,
        pitch: 0,
        weaponId: 'rifle',
        moveSpeedNorm: 0.3,
        sprinting: true,
        hp: 500,
        hpMax: 500,
        armor: 90,
        armorMax: 90,
        kills: 0,
        deaths: 0,
        progressScore: 0,
        teamId: '',
        wallhackRadius: 90,
        alive: true,
        spawnShieldUntil: 0
      }
    ],
    removedEntityIds: []
  });

  assert.equal(runtime.hasAuthoritativeSelfState(), true);
  assert.equal(runtime.getAuthoritativeSelfState().hp, 420);
  assert.equal(runtime.getEntityName('enemy-7'), 'EnemySeven');
  assert.equal(remoteEvents.upserts.length, 1);
  assert.equal(remoteEvents.upserts[0].id, 'enemy-7');

  const spawnCommand = runtime.consumeSelfCommand();
  assert.deepEqual(normalize(spawnCommand), {
    type: 'apply_spawn',
    reason: 'initial',
    x: 12,
    z: 24,
    executeAt: 1000
  });
});

test('client net runtime records local input history and queues respawn commands', () => {
  const { runtime, dispatch, sent, setNow } = createHarness();

  dispatch({
    t: 'welcome',
    selfId: 'user-1',
    roomId: 'ffa-01',
    gameMode: 'ffa'
  });

  runtime.update(0.05, {
    position: { x: 10, y: 1.6, z: 22 },
    rotation: { yaw: 0.25, pitch: -0.1 },
    animation: {
      moveSpeedNorm: 0.84,
      sprinting: true,
      jump: false,
      equippedWeaponId: 'rifle'
    }
  });

  assert.equal(sent[1].t, 'input');
  assert.equal(sent[1].sprinting, true);
  assert.equal(runtime.getInputHistory().length, 1);
  assert.equal(runtime.getInputHistory()[0].payload.x, 10);

  dispatch({
    t: 'death_respawn',
    entityId: 'user-1',
    respawnAt: 1250,
    x: 30,
    z: 40
  });

  assert.equal(runtime.getRespawnState().active, true);
  assert.equal(runtime.consumeSelfCommand(), null);

  setNow(1250);
  runtime.update(0.05, null);

  assert.deepEqual(normalize(runtime.consumeSelfCommand()), {
    type: 'apply_spawn',
    reason: 'respawn',
    x: 30,
    z: 40,
    executeAt: 1250
  });
  assert.equal(runtime.getRespawnState(), null);
});

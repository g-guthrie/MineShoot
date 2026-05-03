import { test, expect } from '@playwright/test';

async function connectGameplaySocket(page, { roomId, playerId, username }) {
  return page.evaluate(({ roomId, playerId, username }) => {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(`${protocol}//${window.location.host}/api/ws`);
      url.searchParams.set('room', roomId);
      url.searchParams.set('pid', playerId);
      url.searchParams.set('username', username);
      url.searchParams.set('actorId', playerId);
      url.searchParams.set('actorName', username);

      const state = {
        selfId: '',
        messages: [],
        snapshots: [],
        entities: {},
        errors: []
      };
      const ws = new WebSocket(url.toString());
      window.__netProof = { ws, state };
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for websocket welcome'));
      }, 8000);

      ws.addEventListener('message', (event) => {
        let msg = null;
        try {
          msg = JSON.parse(String(event.data || ''));
        } catch (err) {
          state.errors.push(String(err && err.message || err || 'parse-error'));
          return;
        }
        state.messages.push(msg);
        if (msg && msg.t === 'welcome') {
          state.selfId = String(msg.selfId || '');
          clearTimeout(timeout);
          resolve({ selfId: state.selfId, roomId: msg.roomId || '' });
          return;
        }
        if (msg && msg.t === 'snapshot') {
          if (!msg.delta) state.entities = {};
          const entities = Array.isArray(msg.entities) ? msg.entities : [];
          for (const entity of entities) {
            if (entity && entity.id) state.entities[String(entity.id)] = { ...entity };
          }
          const patches = Array.isArray(msg.entityPatches) ? msg.entityPatches : [];
          for (const patch of patches) {
            if (!patch || !patch.id) continue;
            const id = String(patch.id);
            state.entities[id] = { ...(state.entities[id] || { id }), ...patch };
          }
          const removed = Array.isArray(msg.removedEntityIds) ? msg.removedEntityIds : [];
          for (const id of removed) delete state.entities[String(id || '')];
          state.snapshots.push({
            ...msg,
            decodedEntities: Object.values(state.entities)
          });
          if (state.snapshots.length > 160) state.snapshots.shift();
        }
      });
      ws.addEventListener('error', () => {
        state.errors.push('websocket-error');
      });
      ws.addEventListener('close', (event) => {
        state.errors.push(`websocket-close:${event.code}`);
      });
    });
  }, { roomId, playerId, username });
}

async function sendGameplayMessage(page, message) {
  await page.evaluate((message) => {
    const proof = window.__netProof;
    if (!proof || !proof.ws || proof.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gameplay websocket is not open');
    }
    proof.ws.send(JSON.stringify(message));
  }, message);
}

async function closeGameplaySocket(page) {
  await page.evaluate(() => {
    if (window.__netProof && window.__netProof.ws) {
      window.__netProof.ws.close();
    }
  }).catch(() => {});
}

async function readEntityMotionProof(page, entityId) {
  return page.evaluate((entityId) => {
    const proof = window.__netProof;
    const snapshots = proof && proof.state ? proof.state.snapshots : [];
    const positions = [];
    let maxSeq = 0;
    let snapshotCount = 0;
    for (const snapshot of snapshots) {
      const entities = Array.isArray(snapshot.decodedEntities) ? snapshot.decodedEntities : [];
      for (const entity of entities) {
        if (!entity || entity.id !== entityId) continue;
        snapshotCount += 1;
        maxSeq = Math.max(maxSeq, Number(entity.seq || 0));
        positions.push({ x: Number(entity.x || 0), z: Number(entity.z || 0) });
      }
    }
    if (positions.length < 2) {
      return { distance: 0, maxSeq, snapshotCount };
    }
    const first = positions[0];
    const last = positions[positions.length - 1];
    const dx = last.x - first.x;
    const dz = last.z - first.z;
    return {
      distance: Math.sqrt((dx * dx) + (dz * dz)),
      maxSeq,
      snapshotCount
    };
  }, entityId);
}

async function readSocketErrors(page) {
  return page.evaluate(() => {
    const proof = window.__netProof;
    return proof && proof.state && Array.isArray(proof.state.errors)
      ? proof.state.errors.slice()
      : [];
  });
}

test('two browser clients exchange real gameplay websocket input and snapshots', async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  const suffix = String(Date.now()).slice(-6);
  const roomId = `proof-${suffix}`;
  const playerA = `proofA${suffix}`;
  const playerB = `proofB${suffix}`;

  await pageA.goto('/');
  await pageB.goto('/');

  const welcomeA = await connectGameplaySocket(pageA, { roomId, playerId: playerA, username: `ALPHA${suffix}` });
  const welcomeB = await connectGameplaySocket(pageB, { roomId, playerId: playerB, username: `BRAVO${suffix}` });
  expect(welcomeA.roomId).toBe(roomId);
  expect(welcomeB.roomId).toBe(roomId);

  await sendGameplayMessage(pageA, { t: 'enter_match' });
  await sendGameplayMessage(pageB, { t: 'enter_match' });

  for (let seq = 1; seq <= 45; seq++) {
    await sendGameplayMessage(pageA, {
      t: 'input',
      seq,
      dtMs: 16,
      yaw: 0,
      pitch: 0,
      forward: true,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: true,
      adsActive: false,
      inputMode: 'intent'
    });
    await pageA.waitForTimeout(16);
  }

  await expect.poll(async () => {
    const proof = await readEntityMotionProof(pageB, playerA);
    return proof.distance > 0.35 && proof.maxSeq >= 30 && proof.snapshotCount >= 2;
  }, {
    timeout: 10000,
    intervals: [100, 200, 500]
  }).toBe(true);

  const selfProof = await readEntityMotionProof(pageA, playerA);
  expect(selfProof.distance).toBeGreaterThan(0.35);
  expect(selfProof.maxSeq).toBeGreaterThanOrEqual(30);
  expect(await readSocketErrors(pageA)).toEqual([]);
  expect(await readSocketErrors(pageB)).toEqual([]);

  await closeGameplaySocket(pageA);
  await closeGameplaySocket(pageB);
  await pageA.close();
  await pageB.close();
});

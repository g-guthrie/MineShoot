import test from 'node:test';
import assert from 'node:assert/strict';

import { createRuntimeProfile } from '../js/core/runtime-profile.js';

function loadRuntimeProfile(search = '', locationOverrides = {}) {
  const location = {
    protocol: 'https:',
    hostname: 'play.example.com',
    host: 'play.example.com',
    origin: 'https://play.example.com',
    search,
    ...locationOverrides
  };

  return createRuntimeProfile({
    protocol: {
      defaults: {
        roomId: 'global'
      }
    },
    location
  });
}

test('runtime profile exposes only the public FFA mode', () => {
  const profile = loadRuntimeProfile();
  const modes = profile.getAvailableModes();
  const normalizedMode = JSON.parse(JSON.stringify(modes[0]));

  assert.equal(modes.length, 1);
  assert.deepEqual(normalizedMode, {
    id: 'cloud_multiplayer',
    label: 'Public FFA',
    menuTitle: 'QUICK MATCH (FFA)',
    menuDesc: 'Authoritative public free-for-all.',
    backendKind: 'cloudflare-prod',
    backendLabel: 'CLOUDFLARE PROD',
    authorityMode: 'networked',
    authMode: 'guest',
    roomStrategy: 'matchmaking',
    roomPrefix: '',
    apiOrigin: 'https://play.example.com',
    backendOrigin: 'https://mayhem.gguthrie-minecraft-fps.workers.dev',
    roomId: 'global',
    gameMode: 'ffa',
    visible: true
  });
});

test('runtime profile ignores legacy mode and room query parameters', () => {
  const profile = loadRuntimeProfile('?mode=single_full_sandbox&room=private-abc123&offline=1');

  assert.equal(profile.getRequestedModeId(), '');
  assert.equal(profile.requestedRoomId(), '');
  assert.equal(profile.getMode('single_full_sandbox'), null);
});

test('runtime profile rejects alternate modes and still selects the public FFA path', () => {
  const profile = loadRuntimeProfile();

  assert.equal(profile.selectMode('single_cloudflare'), null);
  assert.equal(profile.selectMode('single_full_sandbox'), null);

  const selected = profile.selectMode('cloud_multiplayer');
  assert.equal(selected.id, 'cloud_multiplayer');
  assert.equal(selected.gameMode, 'ffa');
  assert.equal(profile.getSelectedMode().id, 'cloud_multiplayer');
});

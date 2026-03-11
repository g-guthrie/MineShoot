import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDemonicMenuModel } from '../demonic/app/menu-model.js';
import {
  getQuickPlayGameModes,
  getSandboxGameModes,
  getDefaultGameMode
} from '../shared/game-modes.js';

test('demonic menu model prefers offline sandbox as the default runtime when available', () => {
  const model = buildDemonicMenuModel({
    runtimeProfile: {
      getAvailableModes() {
        return [
          { id: 'cloud_multiplayer', label: 'Public Lobby', authorityMode: 'networked', backendLabel: 'CLOUDFLARE PROD' },
          { id: 'single_full_sandbox', label: 'Offline Sandbox', authorityMode: 'offline', backendLabel: 'OFFLINE SANDBOX' }
        ];
      }
    },
    shared: {
      getQuickPlayGameModes,
      getSandboxGameModes,
      getDefaultGameMode
    },
    modeRegistry: {
      getRuntimeModes(profile) {
        return profile.getAvailableModes();
      }
    },
    workstreams: []
  });

  assert.equal(model.selectedRuntimeModeId, 'single_full_sandbox');
  assert.equal(model.selectedGameModeId, 'ffa');
  assert.equal(model.supportsSandbox, true);
});

test('demonic menu model keeps explicit selections when provided', () => {
  const model = buildDemonicMenuModel({
    runtimeProfile: {
      getAvailableModes() {
        return [
          { id: 'single_cloudflare', label: 'Solo Cloudflare (Bots)', authorityMode: 'networked', backendLabel: 'CLOUDFLARE PROD' }
        ];
      }
    },
    shared: {
      getQuickPlayGameModes,
      getSandboxGameModes,
      getDefaultGameMode
    },
    modeRegistry: {
      getRuntimeModes(profile) {
        return profile.getAvailableModes();
      }
    },
    selectedRuntimeModeId: 'single_cloudflare',
    selectedGameModeId: 'tdm',
    workstreams: []
  });

  assert.equal(model.selectedRuntimeModeId, 'single_cloudflare');
  assert.equal(model.selectedGameModeId, 'tdm');
  assert.equal(model.launchSummary.gameLabel, 'Team Deathmatch');
});

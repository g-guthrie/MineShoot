import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDemonicMenuModel } from '../demonic/app/menu-model.js';
import {
  getQuickPlayGameModes,
  getSandboxGameModes,
  getDefaultGameMode
} from '../shared/game-modes.js';

test('demonic menu model prefers a Cloudflare-authoritative runtime when available', () => {
  const model = buildDemonicMenuModel({
    runtimeProfile: {
      getAvailableModes() {
        return [
          { id: 'cloud_multiplayer', label: 'Public Lobby', authorityMode: 'networked', backendLabel: 'CLOUDFLARE PROD' },
          { id: 'single_cloudflare', label: 'Solo Cloudflare (Bots)', authorityMode: 'networked', backendLabel: 'CLOUDFLARE PROD', authoritativeTesting: true, preferredForDemonicTesting: true },
          { id: 'single_full_sandbox', label: 'Offline Sandbox', authorityMode: 'offline', backendLabel: 'OFFLINE SANDBOX' }
        ];
      }
    },
    shared: {
      getQuickPlayGameModes,
      getSandboxGameModes,
      getDefaultGameMode,
      getPreferredDemonicRuntimeModeId() {
        return 'single_cloudflare';
      }
    },
    displaySettings: {
      getFpsOptions() { return [30, 60, 120]; },
      getTargetFps() { return 60; }
    },
    modeRegistry: {
      getRuntimeModes(profile) {
        return profile.getAvailableModes();
      }
    },
    workstreams: []
  });

  assert.equal(model.selectedRuntimeModeId, 'single_cloudflare');
  assert.equal(model.selectedGameModeId, 'ffa');
  assert.equal(model.supportsSandbox, true);
  assert.equal(model.selectedFps, 60);
  assert.match(model.launchSummary.note, /Cloudflare-backed/i);
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
    displaySettings: {
      getFpsOptions() { return [30, 60, 120]; },
      getTargetFps() { return 120; }
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
  assert.equal(model.selectedFps, 120);
  assert.equal(model.launchSummary.gameLabel, 'Team Deathmatch');
});

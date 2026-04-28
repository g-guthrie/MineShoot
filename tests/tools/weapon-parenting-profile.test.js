import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultParentingProfile,
  normalizeParentingProfile,
  parseParentingProfile,
  serializeParentingProfile
} from '../../js/tools/weapon-parenting-profile.js';

const WEAPON_IDS = ['rifle', 'pistol', 'shotgun'];
const SEEDS = {
  rifle: {
    assetUrl: '/assets/weapons/toon-shooter/scout-rifle.gltf',
    sticker: { position: [0, -0.1, 0.08], normal: [0, -1, 0] }
  },
  pistol: {
    assetUrl: '/assets/weapons/toon-shooter/revolver.gltf',
    sticker: { position: [0, -0.135, 0.02], normal: [0, -1, 0] }
  },
  shotgun: {
    assetUrl: '/assets/weapons/toon-shooter/shotgun.gltf',
    sticker: { position: [0, -0.1, 0.08], normal: [0, -1, 0] }
  }
};

test('default parenting profile splits character anchor from per-weapon labels', () => {
  const profile = createDefaultParentingProfile(WEAPON_IDS, SEEDS);

  assert.equal(profile.character.id, 'boxman');
  assert.deepEqual(profile.character.handSticker.position, [0, 0, 0]);
  assert.equal(profile.weapons.pistol.assetUrl, '/assets/weapons/toon-shooter/revolver.gltf');
  assert.deepEqual(profile.weapons.pistol.sticker.position, [0, -0.135, 0.02]);
  assert.deepEqual(profile.weapons.pistol.handle.position, [0, -0.135, 0.02]);
  assert.deepEqual(profile.weapons.pistol.translation, [0, 0, 0]);
  assert.equal(profile.weapons.shotgun.scale, 1);
});

test('normalization preserves weapon scale and handle while keeping labels local', () => {
  const profile = normalizeParentingProfile({
    activeWeaponId: 'shotgun',
    character: {
      handSticker: {
        position: [0.31, 0.025, -0.015],
        normal: [1, 0, 0]
      }
    },
    weapons: {
      shotgun: {
        scale: 1.42,
        translation: [0.03555, -0.021, 0.012],
        rotationDeg: [4.49, -12.51, 90.2],
        handle: {
          position: [0.12555, -0.04444, 0.20191],
          normal: [0, -0.99, 0.1],
          size: [0.2, 0.25555, 0.05]
        }
      }
    }
  }, WEAPON_IDS, SEEDS);

  assert.equal(profile.activeWeaponId, 'shotgun');
  assert.equal(profile.weapons.shotgun.scale, 1.42);
  assert.deepEqual(profile.weapons.shotgun.translation, [0.0356, -0.021, 0.012]);
  assert.deepEqual(profile.weapons.shotgun.rotationDeg, [4.49, -12.51, 90.2]);
  assert.deepEqual(profile.weapons.shotgun.handle.position, [0.1256, -0.0444, 0.2019]);
  assert.deepEqual(profile.weapons.shotgun.handle.size, [0.2, 0.2556, 0.05]);
  assert.deepEqual(profile.character.handSticker.position, [0.31, 0.025, -0.015]);
});

test('profile serialization round trips through the public JSON helpers', () => {
  const source = createDefaultParentingProfile(WEAPON_IDS, SEEDS);
  source.activeWeaponId = 'pistol';
  source.weapons.pistol.scale = 1.25;
  source.weapons.pistol.translation = [0.02, 0.01, -0.03];
  source.weapons.pistol.handle.position = [0.02, -0.08, 0.04];

  const json = serializeParentingProfile(source, WEAPON_IDS, SEEDS);
  const parsed = parseParentingProfile(json, WEAPON_IDS, SEEDS);

  assert.equal(parsed.activeWeaponId, 'pistol');
  assert.equal(parsed.weapons.pistol.scale, 1.25);
  assert.deepEqual(parsed.weapons.pistol.translation, [0.02, 0.01, -0.03]);
  assert.deepEqual(parsed.weapons.pistol.handle.position, [0.02, -0.08, 0.04]);
});

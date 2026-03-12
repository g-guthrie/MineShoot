export function createPlayerRuntime(options = {}) {
  const playerApi = options.playerApi;
  if (!playerApi || typeof playerApi.init !== 'function') {
    throw new Error('Player runtime requires a player API.');
  }

  return {
    init(scene) {
      return playerApi.init(scene);
    },
    update(dt) {
      return playerApi.update(dt);
    },
    getCamera() {
      return typeof playerApi.getCamera === 'function' ? playerApi.getCamera() : null;
    },
    getPosition() {
      return typeof playerApi.getPosition === 'function' ? playerApi.getPosition() : null;
    },
    getRotation() {
      return typeof playerApi.getRotation === 'function' ? playerApi.getRotation() : null;
    },
    getNetInputState() {
      return {
        position: typeof playerApi.getPosition === 'function' ? playerApi.getPosition() : null,
        rotation: typeof playerApi.getRotation === 'function' ? playerApi.getRotation() : null,
        animation: typeof playerApi.getAnimNetState === 'function' ? playerApi.getAnimNetState() : null
      };
    },
    fireAnimation() {
      if (typeof playerApi.fireAnimation === 'function') {
        playerApi.fireAnimation();
      }
    },
    getAdsState() {
      return typeof playerApi.getAdsState === 'function' ? playerApi.getAdsState() : null;
    },
    isSprinting() {
      return !!(typeof playerApi.isSprinting === 'function' && playerApi.isSprinting());
    },
    isActionLocked() {
      return !!(typeof playerApi.isActionLocked === 'function' && playerApi.isActionLocked());
    },
    syncAuthoritativeSelfState(selfState) {
      if (typeof playerApi.syncAuthoritativeSelfState === 'function') {
        return playerApi.syncAuthoritativeSelfState(selfState);
      }
      return false;
    },
    applyAuthoritativeMotion(state) {
      if (typeof playerApi.applyAuthoritativeMotion === 'function') {
        return playerApi.applyAuthoritativeMotion(state);
      }
      return false;
    },
    applySelfCommand(command) {
      if (!command || String(command.type || '') !== 'apply_spawn') return false;
      if (typeof playerApi.respawn === 'function') {
        return playerApi.respawn(command.x, command.z);
      }
      return false;
    },
    setHitboxVisibility(visible) {
      if (typeof playerApi.setHitboxVisibility === 'function') {
        return playerApi.setHitboxVisibility(visible);
      }
      return false;
    },
    setWeaponModel(weaponId) {
      if (typeof playerApi.setWeaponModel === 'function') {
        return playerApi.setWeaponModel(weaponId);
      }
      return false;
    }
  };
}

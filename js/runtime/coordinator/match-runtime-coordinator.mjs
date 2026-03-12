export function createMatchRuntimeCoordinator(options = {}) {
  const worldApi = options.worldApi;
  const playerRuntime = options.playerRuntime;
  const netApi = options.netApi;
  const hitscanApi = options.hitscanApi;
  const combatApi = options.combatApi;
  const uiApi = options.uiApi;
  const audioApi = options.audioApi || null;
  const documentRef = options.document || globalThis.document;
  const THREERef = options.THREE || globalThis.THREE;

  if (!worldApi || typeof worldApi.create !== 'function') {
    throw new Error('Match coordinator requires a world API.');
  }
  if (!playerRuntime || typeof playerRuntime.init !== 'function') {
    throw new Error('Match coordinator requires a player runtime.');
  }
  if (!netApi || typeof netApi.update !== 'function') {
    throw new Error('Match coordinator requires a net API.');
  }
  if (!hitscanApi || typeof hitscanApi.fire !== 'function') {
    throw new Error('Match coordinator requires a hitscan API.');
  }
  if (!combatApi || typeof combatApi.init !== 'function') {
    throw new Error('Match coordinator requires a combat API.');
  }
  if (!uiApi || typeof uiApi.init !== 'function') {
    throw new Error('Match coordinator requires a UI API.');
  }

  let camera = null;

  function syncWeaponPresentation() {
    const weapon = hitscanApi.setWeapon ? hitscanApi.setWeapon('rifle') : hitscanApi.getCurrentWeapon();
    const resolvedWeapon = weapon || (hitscanApi.getCurrentWeapon ? hitscanApi.getCurrentWeapon() : null);
    if (!resolvedWeapon) return null;
    if (playerRuntime.setWeaponModel) playerRuntime.setWeaponModel(resolvedWeapon.id);
    if (uiApi.updateWeaponInfo) uiApi.updateWeaponInfo(resolvedWeapon);
    if (uiApi.updateReticle) {
      uiApi.updateReticle(
        resolvedWeapon,
        hitscanApi.getReticleSpec ? hitscanApi.getReticleSpec(resolvedWeapon.id) : null
      );
    }
    return resolvedWeapon;
  }

  function applySelfCommands() {
    if (!netApi.consumeSelfCommand) return;
    let command = netApi.consumeSelfCommand();
    while (command) {
      if (command.type === 'apply_spawn') {
        playerRuntime.applySelfCommand(command);
        if (combatApi.setInvulnTimer) {
          combatApi.setInvulnTimer(command.reason === 'respawn' ? 1.0 : 0.6);
        }
      }
      command = netApi.consumeSelfCommand();
    }
  }

  function handleDamageFeedback(feedback) {
    if (!feedback) return;
    if (audioApi && audioApi.play && documentRef && documentRef.hasFocus && documentRef.hasFocus()) {
      audioApi.play('bulletImpact', {
        killed: !!feedback.killed,
        hitType: feedback.hitType || 'body',
        weapon: feedback.weaponId || 'rifle'
      });
    }
    if (feedback.killed) {
      if (uiApi.showKillMarker) uiApi.showKillMarker();
      if (uiApi.addKill) uiApi.addKill();
    } else if (uiApi.showHitMarker) {
      uiApi.showHitMarker();
    }
    if (feedback.worldPos && uiApi.showDamageNumber && camera && THREERef) {
      uiApi.showDamageNumber(
        new THREERef.Vector3(feedback.worldPos.x, feedback.worldPos.y, feedback.worldPos.z),
        feedback.damage || 0,
        !!feedback.killed,
        camera,
        feedback.hitType || 'body',
        0.24
      );
    }
  }

  return {
    bootstrap(options = {}) {
      const scene = options.scene;
      const worldMeta = options.worldMeta;
      const isPlaying = typeof options.isPlaying === 'function' ? options.isPlaying : function noop() { return false; };

      worldApi.create(scene, worldMeta && worldMeta.worldSeed ? { worldMeta } : undefined);
      uiApi.init();
      camera = playerRuntime.init(scene);

      combatApi.init({
        isPlaying,
        isMultiplayer() {
          return true;
        }
      });
      combatApi.applyArmorProfile(90);
      uiApi.updateHealth(combatApi.getHP(), combatApi.getMaxHP());
      uiApi.updateArmor(combatApi.getArmor(), combatApi.getArmorMax());
      syncWeaponPresentation();
      return camera;
    },
    getCamera() {
      return camera;
    },
    getCurrentWeapon() {
      return hitscanApi.getCurrentWeapon ? hitscanApi.getCurrentWeapon() : null;
    },
    syncWeaponPresentation,
    setDebugVisuals(visible) {
      if (uiApi.setDebugVisuals) uiApi.setDebugVisuals(!!visible);
      if (netApi.setHitboxVisibility) netApi.setHitboxVisibility(!!visible);
      if (playerRuntime.setHitboxVisibility) playerRuntime.setHitboxVisibility(!!visible);
    },
    fire(options = {}) {
      if (!options.isPlaying || !options.hasInputCapture) return false;
      if (playerRuntime.isActionLocked && playerRuntime.isActionLocked()) return false;

      const selfState = netApi.getAuthoritativeSelfState ? netApi.getAuthoritativeSelfState() : null;
      const respawnState = netApi.getRespawnState ? netApi.getRespawnState() : null;
      if ((selfState && selfState.alive === false) || (respawnState && respawnState.active)) return false;
      if (playerRuntime.isSprinting && playerRuntime.isSprinting()) return false;
      if (!camera) return false;

      const adsState = playerRuntime.getAdsState ? playerRuntime.getAdsState() : null;
      const fired = hitscanApi.fire(
        camera,
        function onHitbox(hitboxMesh, _hitPoint, _distance, hitType, _damage, weapon) {
          if (!hitboxMesh || !hitboxMesh.userData || hitboxMesh.userData.ownerType !== 'net') return;
          if (netApi.sendFire) {
            netApi.sendFire(
              hitboxMesh,
              weapon ? weapon.id : 'rifle',
              hitType,
              '',
              !!(adsState && adsState.active)
            );
          }
        },
        function noop() {}
      );

      if (!fired) return false;
      playerRuntime.fireAnimation();
      if (audioApi && audioApi.play && documentRef && documentRef.hasFocus && documentRef.hasFocus()) {
        audioApi.play('fire', { weapon: 'rifle' });
      }
      return true;
    },
    updateFrame(dt) {
      worldApi.update(dt);
      playerRuntime.update(dt);

      const currentWeapon = hitscanApi.getCurrentWeapon ? hitscanApi.getCurrentWeapon() : null;
      if (currentWeapon && uiApi.updateReticle) {
        uiApi.updateReticle(
          currentWeapon,
          hitscanApi.getReticleSpec ? hitscanApi.getReticleSpec(currentWeapon.id) : null
        );
      }

      if (hitscanApi.tick) hitscanApi.tick(dt);
      if (hitscanApi.updateTracers) hitscanApi.updateTracers(dt);
      combatApi.tickInvulnTimer(dt);
      combatApi.tickArmorRegen(dt);

      const inputState = playerRuntime.getNetInputState ? playerRuntime.getNetInputState() : null;
      netApi.update(
        dt,
        inputState ? inputState.position : null,
        inputState ? inputState.rotation : null,
        inputState ? inputState.animation : null
      );

      applySelfCommands();

      const selfState = netApi.getAuthoritativeSelfState ? netApi.getAuthoritativeSelfState() : null;
      const displaySelfState = selfState || (netApi.getSelfPreviewState ? netApi.getSelfPreviewState() : null);
      const matchState = netApi.getMatchState ? netApi.getMatchState() : null;

      if (selfState) {
        if (combatApi.syncFromAuthoritativeSelfState) {
          combatApi.syncFromAuthoritativeSelfState(selfState);
        }
        if (playerRuntime.syncAuthoritativeSelfState) {
          playerRuntime.syncAuthoritativeSelfState(selfState);
        }
      }

      if (netApi.consumeDamageFeedback) {
        let damageFeedback = netApi.consumeDamageFeedback();
        while (damageFeedback) {
          handleDamageFeedback(damageFeedback);
          damageFeedback = netApi.consumeDamageFeedback();
        }
      }

      if (netApi.consumeIncomingDamageFeedback) {
        let incomingDamage = netApi.consumeIncomingDamageFeedback();
        while (incomingDamage) {
          if (combatApi.showIncomingFeedback) {
            combatApi.showIncomingFeedback(
              incomingDamage.sourcePos,
              incomingDamage.damage,
              incomingDamage.hitType
            );
          }
          incomingDamage = netApi.consumeIncomingDamageFeedback();
        }
      }

      if (uiApi.setHitscanTargetState && currentWeapon) {
        const centerTarget = hitscanApi.peekCenterTarget
          ? hitscanApi.peekCenterTarget(camera, currentWeapon.maxRange || 220)
          : null;
        uiApi.setHitscanTargetState(!!(centerTarget && centerTarget.hitbox));
      }

      if (uiApi.updateCooldown) {
        const cooldownRemaining = hitscanApi.cooldownRemaining ? hitscanApi.cooldownRemaining() : 0;
        const cooldownTotal = hitscanApi.getCooldown ? hitscanApi.getCooldown() : 1;
        const cooldownReady = cooldownRemaining <= 0;
        const cooldownPct = cooldownReady ? 1 : (1 - (cooldownRemaining / Math.max(1, cooldownTotal)));
        uiApi.updateCooldown(cooldownReady, cooldownPct);
      }

      if (uiApi.updateMatchStatus) {
        uiApi.updateMatchStatus(matchState, displaySelfState);
      }
      if (uiApi.updateDamageEffects) {
        uiApi.updateDamageEffects(dt);
      }

      return {
        camera,
        currentWeapon,
        matchState,
        displaySelfState
      };
    }
  };
}

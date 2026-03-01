!(function() {
  "use strict";
  var renderer, scene, clock, camera, isPlaying = !1, triggerHeld = !1, beamIntentState = {
    active: !1,
    weaponId: ""
  }, COMBAT_PRIM = (globalThis.__GAME_PRIMITIVES__ || {}).combat || {}, CLASS_PRESETS = COMBAT_PRIM.class_presets || {}, BASE_MAX_HP = Number(COMBAT_PRIM.max_hp || 500), ARMOR_REGEN_DELAY_SEC = Number(COMBAT_PRIM.armor_regen_delay_sec || 6), ARMOR_REGEN_PER_SEC = Number(COMBAT_PRIM.armor_regen_per_sec || 12), playerHP = BASE_MAX_HP, playerMaxHP = BASE_MAX_HP, playerArmor = CLASS_PRESETS.sharpshooter && CLASS_PRESETS.sharpshooter.armorMax || 90, playerArmorMax = playerArmor, armorRegenDelay = 0, respawnInvulnTimer = 0, debugTimer = null, wallhackRing = null, wallhackRingRadius = 0, wallhackRingVisible = !0, plasmaBeamCore = null, plasmaBeamGlow = null, plasmaBeamHaze = null, plasmaBeamGroup = null, plasmaBeamTmpStart = new THREE.Vector3, plasmaBeamTmpEnd = new THREE.Vector3, plasmaBeamTmpMid = new THREE.Vector3, plasmaBeamTmpDir = new THREE.Vector3, wallhackDescriptorBuffer = [], DEFAULT_ARMOR_REGEN_DELAY = ARMOR_REGEN_DELAY_SEC, currentAimTargetId = "", multiplayerMode = !1, startupDebugNotice = "", bootWorldManifest = null, bootState = "booting", bootErrorMessage = "", initPromise = null, ensureRuntimeReady = null, controlsBound = !1, animationStarted = !1, resizeBound = !1, pointerLockBindingsReady = !1, menuTabsReady = !1, menuRuntimeUnsub = null, activeMenuPage = "play", pendingPlayStart = !1, lastStartRequest = 0, pointerLockAttemptTimer = null;
  function runtime() {
    return window.GameRuntime || null;
  }
  function setBootState(nextState, errorMessage) {
    bootState = nextState;
    var rt = runtime();
    "failed" === nextState ? (bootErrorMessage = String(errorMessage || "unknown_startup_error"), 
    rt.dispatch("BOOT_FAILED", {
      reason: bootErrorMessage
    })) : (bootErrorMessage = "", "booting" === nextState ? rt.dispatch("BOOT_BEGIN") : "ready" === nextState ? rt.dispatch("BOOT_READY") : "running" === nextState && rt.dispatch("START_SUCCESS"));
  }
  function writeDebugInfo(text) {
    if (window.GameUI && window.GameUI.setDebugInfo) window.GameUI.setDebugInfo(text || ""); else {
      var debugEl = document.getElementById("debug-info");
      debugEl && (debugEl.textContent = text || "");
    }
  }
  function setTransientDebug(text, ms) {
    writeDebugInfo(text || ""), debugTimer && clearTimeout(debugTimer), debugTimer = text ? setTimeout(function() {
      writeDebugInfo(""), debugTimer = null;
    }, ms || 1e3) : null;
  }
  function clearPointerLockAttempt() {
    pointerLockAttemptTimer && (clearTimeout(pointerLockAttemptTimer), pointerLockAttemptTimer = null);
  }
  function hasInputCapture() {
    var rt = runtime();
    return !!(rt && rt.canAcceptGameplayInput && rt.canAcceptGameplayInput());
  }
  function currentWeaponId() {
    var weapon = window.GameHitscan.getCurrentWeapon();
    return weapon && weapon.id ? String(weapon.id) : "";
  }
  function isContinuousWeaponId(weaponId) {
    return !(!weaponId || !window.GameHitscan.isContinuousWeapon(weaponId));
  }
  function sendBeamIntent(active, weaponId, force) {
    var id = String(weaponId || beamIntentState.weaponId || currentWeaponId() || "");
    if (!id) return !1;
    var nextActive = !!active;
    return !(!force && beamIntentState.weaponId === id && beamIntentState.active === nextActive) && (multiplayerMode && window.GameNet.sendBeamIntent(id, nextActive), 
    beamIntentState.weaponId = id, beamIntentState.active = nextActive, !0);
  }
  function stopBeamIntent(weaponId, force) {
    var id = String(weaponId || beamIntentState.weaponId || currentWeaponId() || "");
    return id && isContinuousWeaponId(id) ? (sendBeamIntent(!1, id, !!force), void (isContinuousWeaponId(currentWeaponId()) || (beamIntentState.weaponId = ""))) : (beamIntentState.active = !1, 
    void (beamIntentState.weaponId = ""));
  }
  function shouldIgnoreKeyboardEvent(e) {
    if (!e) return !1;
    var target = e.target;
    return !(!target || !target.isContentEditable && !/^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || "")) || window.GameUIShell.isTextInputFocused();
  }
  function getCurrentWallhackRadius() {
    if (multiplayerMode) {
      var selfState = window.GameNet.getSelfState();
      if (selfState && "number" == typeof selfState.wallhackRadius) return selfState.wallhackRadius;
    }
    return window.GameClasses.getWallhackRadius();
  }
  function rebuildWallhackRing(radius) {
    if (scene) {
      wallhackRing && wallhackRing.parent && wallhackRing.parent.remove(wallhackRing), 
      wallhackRingRadius = radius;
      for (var points = [], i = 0; i < 96; i++) {
        var a = i / 96 * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      var geo = (new THREE.BufferGeometry).setFromPoints(points), mat = new THREE.LineBasicMaterial({
        color: 6674687,
        transparent: !0,
        opacity: .7,
        depthTest: !1
      });
      (wallhackRing = new THREE.LineLoop(geo, mat)).renderOrder = 30, wallhackRing.visible = wallhackRingVisible, 
      scene.add(wallhackRing);
    }
  }
  function syncWallhackRingRadius() {
    var radius = getCurrentWallhackRadius();
    (!wallhackRing || Math.abs(radius - wallhackRingRadius) > .01) && rebuildWallhackRing(radius);
  }
  function applyDebugVisuals(visible) {
    wallhackRingVisible = !!visible, wallhackRing && (wallhackRing.visible = wallhackRingVisible), 
    window.GameEnemy && window.GameEnemy.setHitboxVisibility(!!visible), window.GameNet.setHitboxVisibility(!!visible), 
    window.GamePlayer.setCollisionDebugVisible(!!visible);
  }
  function syncReticleWithWeapon(weapon) {
    weapon && window.GameUI.updateReticle(weapon, window.GameHitscan.getReticleSpec(weapon.id));
  }
  function applyArmorProfile(armorMax) {
    armorMax = Math.max(1, armorMax || 100), playerArmor > (playerArmorMax = armorMax) && (playerArmor = playerArmorMax), 
    playerArmor < 0 && (playerArmor = 0), window.GameUI.updateArmor(playerArmor, playerArmorMax);
  }
  function applyWeapon(weapon) {
    if (weapon) {
      if (window.GameRules && window.GameClasses && window.GameClasses.getCurrentClass && window.GameRules.canEquip) {
        var cls = window.GameClasses.getCurrentClass(), classId = cls && cls.id ? cls.id : "sharpshooter", gate = window.GameRules.canEquip(classId, weapon.id);
        if (!gate.ok) return void setTransientDebug(gate.reason || "Cannot equip " + weapon.name + " for class " + classId, 1100);
        gate.warn && gate.reason && setTransientDebug("Soft policy: " + gate.reason, 1200);
      }
      var nextWeaponId, prevId, nextId;
      nextWeaponId = weapon.id, prevId = String(beamIntentState.weaponId || ""), nextId = String(nextWeaponId || ""), 
      prevId && prevId !== nextId && isContinuousWeaponId(prevId) && stopBeamIntent(prevId, !0), 
      isContinuousWeaponId(nextId) ? beamIntentState.weaponId = nextId : beamIntentState.active || (beamIntentState.weaponId = ""), 
      window.GameUI.updateWeaponInfo(weapon), window.GamePlayer.setWeaponModel(weapon.id), 
      syncReticleWithWeapon(weapon), multiplayerMode && window.GameNet && window.GameNet.sendEquipWeapon && window.GameNet.sendEquipWeapon(weapon.id), 
      window.GameDocs && window.GameDocs.refresh && window.GameDocs.refresh(), setTransientDebug("Weapon: " + weapon.name, 950);
    }
  }
  function applyClassImmediate(classId) {
    if (!window.GameClasses) return null;
    var selected = window.GameClasses.setClass(classId);
    if (!selected) return null;
    var defaultWeapon = selected.loadoutWeapon;
    (window.GameRules && window.GameRules.getClassDefaultWeapon && (defaultWeapon = window.GameRules.getClassDefaultWeapon(selected.id || classId)), 
    defaultWeapon) && applyWeapon(window.GameLoadout.equipWeapon(defaultWeapon));
    return applyArmorProfile(selected.armorMax || playerArmorMax), window.GameUI.updateClassInfo(window.GameClasses.getHudState()), 
    syncWallhackRingRadius(), window.GameDocs && window.GameDocs.refresh && window.GameDocs.refresh(), 
    selected;
  }
  function queueClassChange(classId) {
    var queued = window.GameClasses.queueClass(classId);
    queued && (multiplayerMode && window.GameNet && window.GameNet.queueClassChange && window.GameNet.queueClassChange(classId), 
    window.GameUI.updateClassInfo(window.GameClasses.getHudState()), window.GameDocs && window.GameDocs.refresh && window.GameDocs.refresh(), 
    setTransientDebug("Queued class: " + queued.name + " (applies on death)", 1300));
  }
  function handleEnemyHit(hitPoint, damage, hitType, result) {
    result && (result.killed ? (window.GameUI.showKillMarker(), window.GameUI.addKill(), 
    window.GameUI.showDamageNumber(hitPoint, damage, !0, camera, hitType)) : (window.GameUI.showHitMarker(), 
    window.GameUI.showDamageNumber(hitPoint, damage, !1, camera, hitType)));
  }
  function consumePlayerDamage(rawDamage, hitType, attackerEnemy) {
    if (!(respawnInvulnTimer > 0) && isPlaying) {
      var damage = Math.max(1, Math.round(rawDamage));
      if (window.GameClasses && window.GameClasses.modifyIncomingDamage && (damage = window.GameClasses.modifyIncomingDamage(damage, hitType)), 
      armorRegenDelay = DEFAULT_ARMOR_REGEN_DELAY, playerArmor > 0) {
        var absorbed = Math.min(playerArmor, damage);
        playerArmor -= absorbed, damage -= absorbed;
      }
      if (damage > 0 && (playerHP -= damage), attackerEnemy && attackerEnemy.group && attackerEnemy.group.position) {
        var playerPos = window.GamePlayer.getPosition(), rot = window.GamePlayer.getRotation();
        window.GameUI.showDirectionalDamage(attackerEnemy.group.position, playerPos, rot && "number" == typeof rot.yaw ? rot.yaw : 0, rawDamage);
      }
      playerHP <= 0 ? (function() {
        if (stopBeamIntent("", !0), !multiplayerMode) {
          var applied = window.GameClasses.applyQueuedClass();
          if (applied) {
            var queuedDefaultWeapon = applied.loadoutWeapon;
            if (window.GameRules && window.GameRules.getClassDefaultWeapon && (queuedDefaultWeapon = window.GameRules.getClassDefaultWeapon(applied.id)), 
            queuedDefaultWeapon) applyWeapon(window.GameLoadout.equipWeapon(queuedDefaultWeapon));
            applyArmorProfile(applied.armorMax || playerArmorMax);
          }
        }
        playerHP = playerMaxHP, multiplayerMode || (playerArmor = playerArmorMax);
        armorRegenDelay = 0, window.GameUI.updateHealth(playerHP, playerMaxHP), window.GameUI.updateArmor(playerArmor, playerArmorMax), 
        multiplayerMode || (window.GamePlayer.respawnRandom(), respawnInvulnTimer = 1);
        window.GameUI.updateDamageEffects(5), window.GameUI.updateClassInfo(window.GameClasses.getHudState()), 
        syncWallhackRingRadius();
      })() : (window.GameUI.updateHealth(playerHP, playerMaxHP), window.GameUI.updateArmor(playerArmor, playerArmorMax));
    }
  }
  var tracerTmpDir = new THREE.Vector3, tracerTmpPos = new THREE.Vector3;
  function tryPlayerFire() {
    if (window.GameHitscan.fire(camera, function(hitboxMesh, hitPoint, distance, hitType, damage, weapon) {
      (window.GameClasses && window.GameClasses.modifyOutgoingDamage && (damage = window.GameClasses.modifyOutgoingDamage(damage, hitType, weapon ? weapon.id : "")), 
      multiplayerMode && hitboxMesh && hitboxMesh.userData && "net" === hitboxMesh.userData.ownerType) || window.GameEnemy && window.GameEnemy.damage && handleEnemyHit(hitPoint, damage, hitType, window.GameEnemy.damage(hitboxMesh, damage));
    }, function() {})) {
      if (multiplayerMode && window.GameNet && window.GameNet.sendFireIntent) {
        var firedWeapon = window.GameHitscan.getCurrentWeapon();
        firedWeapon && "plasma" !== firedWeapon.id && window.GameNet.sendFireIntent(firedWeapon.id, firedWeapon.automatic ? "auto" : "single");
      }
      window.GamePlayer.fireAnimation(), (function(weapon) {
        if (window.GameParticles && window.GameParticles.spawn && weapon && "plasma" !== weapon.id) {
          var muzzlePos = window.GamePlayer.getMuzzleWorldPos ? window.GamePlayer.getMuzzleWorldPos() : null;
          if (muzzlePos) {
            camera.getWorldDirection(tracerTmpDir);
            for (var tracerCount = "shotgun" === weapon.id ? 4 : 1, tracerColors = [ 16777164, 16772778, 16777215 ], i = 0; i < tracerCount; i++) {
              var spread = "shotgun" === weapon.id ? .06 : .005, dx = tracerTmpDir.x + (Math.random() - .5) * spread, dy = tracerTmpDir.y + (Math.random() - .5) * spread, dz = tracerTmpDir.z + (Math.random() - .5) * spread, speed = 80 + 40 * Math.random();
              tracerTmpPos.set(dx * speed, dy * speed, dz * speed), window.GameParticles.spawn(muzzlePos, tracerTmpPos, tracerColors[Math.floor(Math.random() * tracerColors.length)], .03, .08, {
                gravity: 0,
                drag: 0,
                scaleEnd: .01
              });
            }
          }
        }
      })(window.GameHitscan.getCurrentWeapon());
    }
  }
  function applyPendingWeaponIfAny() {
    if (window.GameLoadout && window.GameLoadout.applyPendingWeaponOnResume) {
      var pendingWeapon = window.GameLoadout.applyPendingWeaponOnResume();
      pendingWeapon && (applyWeapon(pendingWeapon), setTransientDebug("Equipped on resume: " + pendingWeapon.name, 900));
    }
  }
  function closeManualIfOpen() {
    window.GameUIShell.isManualOpen() && window.GameUIShell.closeManual();
  }
  function handlePointerLockFailure(reasonText) {
    var message = String(reasonText || "POINTER LOCK DENIED - CLICK PLAY TO RETRY");
    clearPointerLockAttempt(), runtime().dispatch("POINTER_LOCK_DENIED", {
      reason: message
    }), isPlaying = !1, triggerHeld = !1, stopBeamIntent("", !0), window.GamePlayer && window.GamePlayer.onPointerLockLost && window.GamePlayer.onPointerLockLost(), 
    "running" === bootState && setBootState("ready"), setTransientDebug(message, 1800);
  }
  function requestPlayStart(e) {
    var now = performance.now();
    if (!(now - lastStartRequest < 140)) {
      if (lastStartRequest = now, e) {
        if ("number" == typeof e.button && 0 !== e.button) return;
        e.preventDefault(), e.stopPropagation();
      }
      if (closeManualIfOpen(), "failed" !== bootState) {
        if ("ready" !== bootState && "running" !== bootState) return pendingPlayStart = !0, 
        void setTransientDebug("Initializing runtime...", 1e3);
        runtime().dispatch("START_REQUEST"), runtime().dispatch("POINTER_LOCK_WAIT");
        var target = renderer && renderer.domElement;
        if (!target) return pendingPlayStart = !0, void ("function" == typeof ensureRuntimeReady ? (setTransientDebug("Renderer not ready yet. Initializing...", 1400), 
        ensureRuntimeReady().catch(function() {})) : setTransientDebug("Runtime not ready yet.", 1200));
        var requestLock = target.requestPointerLock || target.webkitRequestPointerLock || target.mozRequestPointerLock;
        if ("function" != typeof requestLock) return runtime().dispatch("POINTER_LOCK_UNSUPPORTED", {
          reason: "POINTER LOCK UNSUPPORTED IN THIS BROWSER"
        }), void setTransientDebug("POINTER LOCK UNSUPPORTED IN THIS BROWSER", 2200);
        try {
          var maybePromise = requestLock.call(target);
          clearPointerLockAttempt(), pointerLockAttemptTimer = setTimeout(function() {
            if (pointerLockAttemptTimer = null, target !== document.pointerLockElement) {
              var rt = runtime(), snap = rt && rt.getState ? rt.getState() : null;
              snap && "starting_lock" !== snap.mode || handlePointerLockFailure("WAITING FOR MOUSE CAPTURE - CLICK PLAY TO RETRY");
            }
          }, 800), maybePromise && "function" == typeof maybePromise.catch && maybePromise.catch(function() {
            target === document.pointerLockElement || handlePointerLockFailure("POINTER LOCK DENIED - CLICK PLAY TO RETRY");
          });
        } catch (err) {
          handlePointerLockFailure("POINTER LOCK DENIED - CLICK PLAY TO RETRY");
        }
      } else "function" == typeof ensureRuntimeReady ? (setTransientDebug("Startup failed. Retrying runtime bootstrap...", 1800), 
      pendingPlayStart = !0, lastStartRequest = 0, initPromise = null, setBootState("booting"), 
      ensureRuntimeReady().catch(function() {})) : setTransientDebug("Startup failed: " + (bootErrorMessage || "unknown error"), 2600);
    }
  }
  function setupPointerLock() {
    var playBtn;
    function initMenuTabs() {
      if (!menuTabsReady) {
        menuTabsReady = !0;
        var overlayEl = document.getElementById("overlay");
        if (overlayEl) {
          for (var tabEls = overlayEl.querySelectorAll(".pipboy-tab[data-page]"), pageEls = overlayEl.querySelectorAll(".pipboy-page[data-page]"), runtimeStatusEl = document.getElementById("pipboy-runtime-status"), sessionModeEl = document.getElementById("pipboy-session-mode"), footerHintEl = document.getElementById("pipboy-footer-hint"), t = 0; t < tabEls.length; t++) tabEls[t].addEventListener("click", function(e) {
            e.preventDefault(), e.stopPropagation(), setActivePage(this.dataset.page || "play");
          });
          if (menuRuntimeUnsub) {
            try {
              menuRuntimeUnsub();
            } catch (_err) {}
            menuRuntimeUnsub = null;
          }
          var rt = runtime();
          rt && rt.subscribe ? menuRuntimeUnsub = rt.subscribe(function(snapshot) {
            var mode = snapshot && snapshot.mode, captureState = snapshot && snapshot.captureState, captureError = snapshot && snapshot.captureError;
            if (runtimeStatusEl && (runtimeStatusEl.textContent = "running" === mode ? "IN COMBAT" : "paused" === mode ? "PAUSED" : "manual" === mode ? "MANUAL OPEN" : "starting_lock" === mode ? "WAITING FOR MOUSE CAPTURE" : "failed" === mode ? "FAILED" : "boot" === mode || "auth" === mode ? "BOOTING" : "READY"), 
            sessionModeEl && (sessionModeEl.textContent = multiplayerMode ? "ONLINE AUTH" : "LOCAL DEV"), 
            footerHintEl) if ("failed" === mode) {
              var reason = snapshot.failedReason ? String(snapshot.failedReason) : "unknown_startup_error";
              footerHintEl.textContent = "BOOT ERROR: " + reason + " | PRESS PLAY TO RETRY";
            } else captureError && ("denied" === captureState || "unsupported" === captureState) ? footerHintEl.textContent = String(captureError) : footerHintEl.textContent = "starting_lock" === mode ? "WAITING FOR MOUSE CAPTURE   |   CLICK PLAY TO RETRY" : "loadout" === activeMenuPage ? "LOADOUT: weapon changes apply on resume; class changes queue to next respawn" : "controls" === activeMenuPage ? "CONTROLS: 1-5 + T weapons | 6-0 classes | I manual | H debug visuals" : "about" === activeMenuPage ? "PIPELINE: stable runtime state machine + authoritative net contracts" : "TABS: PLAY / LOADOUT / CONTROLS / ABOUT   |   ESC to release capture";
            snapshot && snapshot.overlayVisible && "play" !== activeMenuPage && "paused" !== mode && "manual" !== mode && setActivePage("play");
          }) : (runtimeStatusEl && (runtimeStatusEl.textContent = "READY"), sessionModeEl && (sessionModeEl.textContent = multiplayerMode ? "ONLINE AUTH" : "LOCAL DEV")), 
          setActivePage("play");
        }
      }
      function setActivePage(pageId) {
        pageId = String(pageId || "play"), activeMenuPage = pageId;
        for (var i = 0; i < tabEls.length; i++) {
          var isActiveTab = tabEls[i].dataset.page === pageId;
          tabEls[i].classList.toggle("active", isActiveTab), tabEls[i].setAttribute("aria-selected", isActiveTab ? "true" : "false");
        }
        for (var j = 0; j < pageEls.length; j++) {
          var isActivePage = pageEls[j].dataset.page === pageId;
          pageEls[j].classList.toggle("active", isActivePage);
        }
        footerHintEl && (footerHintEl.textContent = "loadout" === pageId ? "LOADOUT: weapon changes apply on resume; class changes queue to next respawn" : "controls" === pageId ? "CONTROLS: 1-5 + T weapons | 6-0 classes | I manual | H debug visuals" : "about" === pageId ? "PIPELINE: stable runtime state machine + authoritative net contracts" : "TABS: PLAY / LOADOUT / CONTROLS / ABOUT   |   ESC to release capture");
      }
    }
    initMenuTabs(), (playBtn = document.getElementById("play-btn")) && !playBtn.__playBound && (playBtn.__playBound = !0, 
    playBtn.addEventListener("click", requestPlayStart), playBtn.addEventListener("touchend", requestPlayStart, {
      passive: !1
    })), pointerLockBindingsReady || (pointerLockBindingsReady = !0, document.addEventListener("pointerlockchange", function() {
      var pointerTarget = renderer && renderer.domElement;
      if (pointerTarget && document.pointerLockElement === pointerTarget) return clearPointerLockAttempt(), 
      runtime().dispatch("POINTER_LOCK_GAINED"), runtime().dispatch("START_SUCCESS"), 
      closeManualIfOpen(), applyPendingWeaponIfAny(), isPlaying = !0, window.GamePlayer && window.GamePlayer.onPointerLockGained && window.GamePlayer.onPointerLockGained(), 
      void setBootState("running");
      runtime().dispatch("POINTER_LOCK_LOST"), isPlaying = !1, triggerHeld = !1, stopBeamIntent("", !0), 
      window.GamePlayer && window.GamePlayer.onPointerLockLost && window.GamePlayer.onPointerLockLost(), 
      "running" === bootState && setBootState("ready");
    }), document.addEventListener("pointerlockerror", function() {
      document.pointerLockElement || (runtime().dispatch("POINTER_LOCK_DENIED", {
        reason: "POINTER LOCK DENIED - CLICK PLAY TO RETRY"
      }), isPlaying = !1, triggerHeld = !1, stopBeamIntent("", !0), window.GamePlayer && window.GamePlayer.onPointerLockLost && window.GamePlayer.onPointerLockLost(), 
      setTransientDebug("POINTER LOCK DENIED - CLICK PLAY TO RETRY", 1600));
    }), document.addEventListener("keydown", function(e) {
      shouldIgnoreKeyboardEvent(e) || "Escape" === e.code && document.pointerLockElement && (runtime().dispatch("PAUSE"), 
      isPlaying = !1, triggerHeld = !1, stopBeamIntent("", !0), window.GamePlayer && window.GamePlayer.onPointerLockLost && window.GamePlayer.onPointerLockLost(), 
      "running" === bootState && setBootState("ready"));
    }));
  }
  function setupShooting() {
    document.addEventListener("mousedown", function(e) {
      0 === e.button && hasInputCapture() && (triggerHeld = !0, (function() {
        if (multiplayerMode) {
          var id = currentWeaponId();
          isContinuousWeaponId(id) && sendBeamIntent(!0, id, !1);
        }
      })(), tryPlayerFire());
    }), document.addEventListener("mouseup", function(e) {
      0 === e.button && (triggerHeld = !1, stopBeamIntent("", !1));
    }), window.addEventListener("blur", function() {
      triggerHeld = !1, stopBeamIntent("", !1);
    });
  }
  function tryThrow(type) {
    if (hasInputCapture()) if (multiplayerMode) {
      window.GameNet && window.GameNet.sendThrowIntent && (window.GameNet.sendThrowIntent(type) || setTransientDebug("Throwable send failed (network unavailable).", 900));
    } else {
      var outcome = window.GameThrowables.throw(type, camera);
      window.GameUI.updateThrowableInfo(outcome.state), outcome.ok || "cooldown" !== outcome.reason || setTransientDebug(type + " is recharging.", 600);
    }
  }
  function bindGameplayControlsOnce() {
    controlsBound || (controlsBound = !0, setupShooting(), document.addEventListener("keydown", function(e) {
      if (!shouldIgnoreKeyboardEvent(e)) if ("Digit1" !== e.code && "Digit2" !== e.code && "Digit3" !== e.code && "Digit4" !== e.code && "Digit5" !== e.code) {
        if ("KeyT" === e.code) {
          var tEquipped = window.GameLoadout.equipSlot(5);
          tEquipped && applyWeapon(tEquipped);
        }
      } else {
        var idx = parseInt(e.code.replace("Digit", ""), 10) - 1, equipped = window.GameLoadout.equipSlot(idx);
        equipped && applyWeapon(equipped);
      }
    }), document.addEventListener("wheel", function(e) {
      hasInputCapture() && (e.preventDefault(), applyWeapon(window.GameLoadout.cycle(e.deltaY > 0 ? 1 : -1)));
    }, {
      passive: !1
    }), document.addEventListener("keydown", function(e) {
      if (!shouldIgnoreKeyboardEvent(e)) switch (e.code) {
       case "KeyG":
        tryThrow("frag");
        break;

       case "KeyV":
        tryThrow("seeker");
        break;

       case "KeyB":
        tryThrow("molotov");
        break;

       case "KeyQ":
        tryThrow("knife");
      }
    }), (function() {
      var classOrder = window.GameClasses.getOrder(), keyToClass = {
        Digit6: classOrder[0],
        Digit7: classOrder[1],
        Digit8: classOrder[2],
        Digit9: classOrder[3],
        Digit0: classOrder[4]
      };
      function triggerClassAbility(slot) {
        if (multiplayerMode) setTransientDebug("Abilities are local-only right now in net mode.", 900); else if (hasInputCapture()) {
          var playerPos = window.GamePlayer.getPosition(), rot = window.GamePlayer.getRotation(), outcome = window.GameClasses.triggerAbility(slot, camera, playerPos, rot, function(hitData) {
            hitData && hitData.result && handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
          }, setTransientDebug);
          window.GameUI.updateClassInfo(window.GameClasses.getHudState()), outcome && !outcome.ok && outcome.message && setTransientDebug(outcome.message, 700);
        }
      }
      document.addEventListener("keydown", function(e) {
        shouldIgnoreKeyboardEvent(e) || (keyToClass[e.code] ? queueClassChange(keyToClass[e.code]) : "KeyE" !== e.code ? "KeyR" === e.code && triggerClassAbility(2) : triggerClassAbility(1));
      });
    })(), (function() {
      var btn = document.getElementById("camera-toggle");
      function syncButton() {
        btn && (btn.textContent = "third" === window.GamePlayer.getPerspective() ? "CAM: THIRD" : "CAM: FIRST");
      }
      function togglePerspective() {
        var mode = window.GamePlayer.togglePerspective();
        syncButton(), syncReticleWithWeapon(window.GameHitscan.getCurrentWeapon()), setTransientDebug("third" === mode ? "Third-person camera" : "First-person camera", 800);
      }
      btn && btn.addEventListener("click", function(e) {
        e.preventDefault(), e.stopPropagation(), togglePerspective();
      }), document.addEventListener("keydown", function(e) {
        shouldIgnoreKeyboardEvent(e) || "KeyC" === e.code && togglePerspective();
      }), syncButton();
    })(), (function() {
      var weaponWrap = document.getElementById("loadout-weapon-buttons"), classWrap = document.getElementById("loadout-class-buttons"), applyBtn = document.getElementById("loadout-apply"), plasmaToggleBtn = document.getElementById("loadout-plasma-toggle");
      if (weaponWrap && classWrap && applyBtn && plasmaToggleBtn) {
        var catalogMap = (function() {
          for (var catalog = window.GameHitscan.getWeaponCatalog(), map = {}, i = 0; i < catalog.length; i++) map[catalog[i].id] = catalog[i];
          return map;
        })(), includePlasma = !0, currentLoadout = window.GameLoadout.getSlots(), pendingWeapon = window.GameLoadout.getPendingWeapon();
        -1 === currentLoadout.indexOf("plasma") && (includePlasma = !1), plasmaToggleBtn.addEventListener("click", function(e) {
          e.preventDefault(), e.stopPropagation(), includePlasma = !includePlasma, currentLoadout = normalizeLoadout(currentLoadout), 
          renderWeaponButtons();
        }), applyBtn.addEventListener("click", function(e) {
          e.preventDefault(), e.stopPropagation();
          var next = normalizeLoadout(filteredLoadout());
          currentLoadout = next.slice();
          var applied = window.GameLoadout.setSlots(next), finalSlots = applied && applied.slots ? applied.slots.slice() : next.slice();
          finalSlots = normalizeLoadout(finalSlots);
          var currentWeapon = window.GameHitscan.getCurrentWeapon();
          -1 === finalSlots.indexOf(currentWeapon.id) && (currentWeapon = window.GameLoadout.equipSlot(0)), 
          applyWeapon(currentWeapon), renderWeaponButtons(), setTransientDebug("Loadout applied: " + finalSlots.join(", "), 1300);
        }), renderWeaponButtons(), (function renderClassButtons() {
          classWrap.innerHTML = "";
          for (var classes = window.GameClasses.getCatalog(), hud = window.GameClasses.getHudState(), queued = hud && hud.queuedClassId ? hud.queuedClassId : "", classKeys = [ "6", "7", "8", "9", "0" ], i = 0; i < classes.length; i++) {
            var c = classes[i], btn = document.createElement("button");
            btn.type = "button", btn.className = "loadout-choice-btn", queued && c.id === queued && btn.classList.add("active"), 
            btn.dataset.classId = c.id, btn.textContent = c.name + " (KEY " + (classKeys[i] || "-") + ")", 
            btn.addEventListener("click", function(e) {
              e.preventDefault(), e.stopPropagation(), queueClassChange(this.dataset.classId), 
              renderClassButtons();
            }), classWrap.appendChild(btn);
          }
        })();
      }
      function normalizeLoadout(list) {
        for (var seen = {}, out = [], i = 0; i < list.length; i++) {
          var id = String(list[i] || "");
          id && !seen[id] && (includePlasma || "plasma" !== id) && catalogMap[id] && (seen[id] = !0, 
          out.push(id));
        }
        return 0 === out.length && out.push("rifle"), out;
      }
      function filteredLoadout() {
        return normalizeLoadout(currentLoadout);
      }
      function renderWeaponButtons() {
        currentLoadout = normalizeLoadout(currentLoadout), plasmaToggleBtn.textContent = includePlasma ? "PLASMA: ENABLED" : "PLASMA: DISABLED", 
        weaponWrap.innerHTML = "";
        for (var selected = window.GameHitscan.getCurrentWeapon(), selectedId = selected ? selected.id : "", list = filteredLoadout(), i = 0; i < list.length; i++) {
          var id = list[i], btn = document.createElement("button");
          btn.type = "button", btn.className = "loadout-choice-btn", id === selectedId && btn.classList.add("active"), 
          id === pendingWeapon && btn.classList.add("pending"), btn.dataset.weaponId = id, 
          btn.textContent = "SLOT " + (i + 1) + ": " + (catalogMap[id] && catalogMap[id].name ? catalogMap[id].name : id), 
          btn.addEventListener("click", function(e) {
            e.preventDefault(), e.stopPropagation();
            var wid = this.dataset.weaponId;
            pendingWeapon = wid;
            var set = window.GameLoadout.setPendingWeapon(wid);
            set.ok ? (setTransientDebug("Pending weapon for resume: " + wid, 900), renderWeaponButtons()) : setTransientDebug(set.reason || "Cannot queue weapon " + wid, 900);
          }), weaponWrap.appendChild(btn);
        }
      }
    })(), document.addEventListener("keydown", function(e) {
      if (!shouldIgnoreKeyboardEvent(e)) return "KeyI" === e.code ? (e.preventDefault(), 
      void window.GameUIShell.toggleManual()) : void ("Escape" === e.code && window.GameDocs && window.GameDocs.isOpen && window.GameDocs.isOpen() && window.GameUIShell.closeManual());
    }), document.addEventListener("keydown", function(e) {
      shouldIgnoreKeyboardEvent(e) || "KeyH" === e.code && (applyDebugVisuals(!wallhackRingVisible), 
      setTransientDebug(wallhackRingVisible ? "Dev visuals: ON" : "Dev visuals: OFF", 1100));
    }));
  }
  function safeInit(label, fn) {
    try {
      return {
        ok: !0,
        value: fn()
      };
    } catch (err) {
      var msg = err && err.message ? err.message : String(err || "unknown_error");
      return console.error("[init] " + label + " failed:", err), setTransientDebug(label + " init failed: " + msg, 1800), 
      {
        ok: !1,
        error: err
      };
    }
  }
  function initGame() {
    (renderer = new THREE.WebGLRenderer({
      antialias: !0
    })).setSize(window.innerWidth, window.innerHeight), renderer.setPixelRatio(window.devicePixelRatio), 
    document.body.appendChild(renderer.domElement), scene = new THREE.Scene, clock = new THREE.Clock;
    var worldManifest = bootWorldManifest;
    if (!worldManifest && window.GameNet && window.GameNet.getWorldManifest && (worldManifest = window.GameNet.getWorldManifest()), 
    !worldManifest && window.GameWorld && window.GameWorld.getLocalManifest && (worldManifest = window.GameWorld.getLocalManifest()), 
    !safeInit("world", function() {
      return window.GameWorld.create(scene, worldManifest || null);
    }).ok) throw new Error("World bootstrap failed");
    safeInit("particles", function() {
      window.GameParticles.init(scene);
    }), safeInit("ui", function() {
      window.GameUI.init();
    }), safeInit("docs", function() {
      window.GameDocs.init();
    }), safeInit("overhead", function() {
      window.GameOverhead.init();
    }), safeInit("wallhack", function() {
      window.GameWallhack.init(scene), window.GameWallhack.setEnabled(!0);
    }), (plasmaBeamGroup = new THREE.Group).visible = !1, plasmaBeamGroup.renderOrder = 24;
    var coreCyl = new THREE.CylinderGeometry(.03, .03, 1, 6, 1);
    plasmaBeamCore = new THREE.Mesh(coreCyl, new THREE.MeshBasicMaterial({
      color: 15663103,
      transparent: !0,
      opacity: 1,
      depthWrite: !1
    }));
    var glowCyl = new THREE.CylinderGeometry(.08, .08, 1, 6, 1);
    plasmaBeamGlow = new THREE.Mesh(glowCyl, new THREE.MeshBasicMaterial({
      color: 6741503,
      transparent: !0,
      opacity: .4,
      depthWrite: !1
    }));
    var hazeCyl = new THREE.CylinderGeometry(.18, .18, 1, 6, 1);
    plasmaBeamHaze = new THREE.Mesh(hazeCyl, new THREE.MeshBasicMaterial({
      color: 4504558,
      transparent: !0,
      opacity: .12,
      depthWrite: !1
    })), plasmaBeamGroup.add(plasmaBeamCore), plasmaBeamGroup.add(plasmaBeamGlow), plasmaBeamGroup.add(plasmaBeamHaze), 
    scene.add(plasmaBeamGroup), startupDebugNotice && (setTransientDebug(startupDebugNotice, 1800), 
    startupDebugNotice = "");
    var playerInit = safeInit("player", function() {
      return window.GamePlayer.init(scene);
    });
    if (!playerInit.ok || !playerInit.value) throw new Error("Player bootstrap failed");
    camera = playerInit.value, multiplayerMode = !!(window.GameNet && window.GameNet.getCurrentUser && window.GameNet.getCurrentUser()), 
    safeInit("throwables", function() {
      window.GameThrowables.init(scene), window.GameThrowables.setMode(multiplayerMode ? "network" : "local"), 
      window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
    }), safeInit(multiplayerMode ? "network" : "enemies", function() {
      if (multiplayerMode) window.GameNet.init(scene); else {
        var enemyCount = window.GameWorld.getRecommendedEnemyCount ? window.GameWorld.getRecommendedEnemyCount() : 5;
        window.GameEnemy.init(scene, enemyCount);
      }
    }), safeInit("classes", function() {
      window.GameClasses.init(scene);
    }), safeInit("loadout", function() {
      window.GameLoadout.init();
    });
    var initialClass = window.GameClasses && window.GameClasses.getCurrentClass ? window.GameClasses.getCurrentClass() : {
      id: "sharpshooter"
    };
    if (multiplayerMode && window.GameNet && window.GameNet.getCurrentUser) {
      var netUser = window.GameNet.getCurrentUser();
      netUser && netUser.classId && (initialClass = {
        id: netUser.classId
      });
    }
    initialClass && initialClass.id && safeInit("apply-class", function() {
      applyClassImmediate(initialClass.id);
    }), playerHP = playerMaxHP, applyArmorProfile(playerArmor = window.GameClasses && window.GameClasses.getArmorMax ? window.GameClasses.getArmorMax() : 90), 
    window.GameUI && window.GameUI.updateHealth && window.GameUI.updateHealth(playerHP, playerMaxHP), 
    window.GameUI && window.GameUI.updateClassInfo && window.GameClasses && window.GameClasses.getHudState && window.GameUI.updateClassInfo(window.GameClasses.getHudState()), 
    rebuildWallhackRing(getCurrentWallhackRadius()), applyDebugVisuals(!0), window.GameHitscan && window.GameHitscan.getCurrentWeapon && applyWeapon(window.GameHitscan.getCurrentWeapon()), 
    bindGameplayControlsOnce(), resizeBound || (resizeBound = !0, window.addEventListener("resize", function() {
      renderer && camera && (renderer.setSize(window.innerWidth, window.innerHeight), 
      camera.isPerspectiveCamera && (camera.aspect = window.innerWidth / Math.max(1, window.innerHeight), 
      camera.updateProjectionMatrix()));
    })), animationStarted || (animationStarted = !0, animate());
  }
  function animate() {
    if (requestAnimationFrame(animate), camera && scene && renderer && window.GamePlayer && window.GamePlayer.update && clock) {
      var dt = clock.getDelta();
      dt > .1 && (dt = .1), window.GamePlayer.update(dt);
      var currentWeapon = window.GameHitscan.getCurrentWeapon(), currentWeaponIsContinuous = currentWeapon && isContinuousWeaponId(currentWeapon.id);
      currentWeapon && ("shotgun" === currentWeapon.id || currentWeaponIsContinuous) && syncReticleWithWeapon(currentWeapon);
      var inputCaptured = hasInputCapture();
      !inputCaptured && beamIntentState.active && stopBeamIntent("", !1), triggerHeld && inputCaptured && currentWeapon && currentWeapon.automatic && !currentWeaponIsContinuous && tryPlayerFire();
      var plasmaState = window.GameHitscan.updatePlasmaBeam(dt, camera, {
        triggerHeld: triggerHeld && inputCaptured,
        onLocalTick: function(target, damage) {
          if (!multiplayerMode && target && "enemy" === target.ownerType && target.hitbox && window.GameEnemy && window.GameEnemy.damage) {
            var result = window.GameEnemy.damage(target.hitbox, damage);
            if (result) handleEnemyHit(target.worldPos ? target.worldPos.clone() : target.hitbox.position.clone(), damage, "body", result);
          }
        }
      });
      if (window.GameUI.updatePlasmaState(plasmaState), plasmaBeamGroup) if (plasmaState && plasmaState.active) {
        plasmaBeamTmpStart.copy(plasmaState.beamStart), plasmaBeamTmpEnd.copy(plasmaState.beamEnd), 
        plasmaBeamTmpDir.copy(plasmaBeamTmpEnd).sub(plasmaBeamTmpStart);
        var beamLen = plasmaBeamTmpDir.length();
        beamLen < .01 && (beamLen = .01), plasmaBeamTmpDir.divideScalar(beamLen), plasmaBeamTmpMid.copy(plasmaBeamTmpStart).add(plasmaBeamTmpEnd).multiplyScalar(.5), 
        plasmaBeamGroup.position.copy(plasmaBeamTmpMid), plasmaBeamGroup.lookAt(plasmaBeamTmpEnd), 
        plasmaBeamGroup.rotateX(Math.PI / 2), plasmaBeamCore.scale.set(1, beamLen, 1), plasmaBeamGlow.scale.set(1, beamLen, 1), 
        plasmaBeamHaze.scale.set(1, beamLen, 1);
        var flicker = .85 + .15 * Math.random(), overheated = plasmaState.overheated;
        if (plasmaBeamCore.material.opacity = overheated ? .15 : flicker, plasmaBeamGlow.material.opacity = overheated ? .08 : .35 * flicker, 
        plasmaBeamHaze.material.opacity = overheated ? .04 : .1 * flicker, overheated ? (plasmaBeamGlow.material.color.setHex(16746564), 
        plasmaBeamHaze.material.color.setHex(13395490)) : (plasmaBeamGlow.material.color.setHex(6741503), 
        plasmaBeamHaze.material.color.setHex(4504558)), plasmaBeamGroup.visible = !0, window.GameParticles && window.GameParticles.spawn) {
          for (var bp = 0; bp < 2 + Math.floor(2 * Math.random()); bp++) {
            var bpT = Math.random();
            plasmaBeamTmpMid.copy(plasmaBeamTmpStart).lerp(plasmaBeamTmpEnd, bpT), plasmaBeamTmpMid.x += .08 * (Math.random() - .5), 
            plasmaBeamTmpMid.y += .08 * (Math.random() - .5), plasmaBeamTmpMid.z += .08 * (Math.random() - .5), 
            window.GameParticles.spawn(plasmaBeamTmpMid, {
              x: .5 * (Math.random() - .5),
              y: .5 * (Math.random() - .5),
              z: .5 * (Math.random() - .5)
            }, overheated ? 16746564 : 8974079, .03 + .02 * Math.random(), .08 + .06 * Math.random(), {
              gravity: 0,
              drag: .5,
              scaleEnd: 0
            });
          }
          Math.random() < .6 && window.GameParticles.burst(plasmaBeamTmpEnd, 1 + Math.floor(2 * Math.random()), {
            color: overheated ? [ 16737826, 16746564 ] : [ 8974079, 11203839, 16777215 ],
            speedRange: [ 1, 4 ],
            scaleRange: [ .02, .04 ],
            lifeRange: [ .05, .12 ],
            gravity: .5,
            drag: .3
          });
        }
      } else plasmaBeamGroup.visible = !1;
      respawnInvulnTimer > 0 && (respawnInvulnTimer -= dt) < 0 && (respawnInvulnTimer = 0), 
      multiplayerMode || (armorRegenDelay > 0 ? (armorRegenDelay -= dt) < 0 && (armorRegenDelay = 0) : playerArmor < playerArmorMax && (playerArmor += ARMOR_REGEN_PER_SEC * dt) > playerArmorMax && (playerArmor = playerArmorMax));
      var playerEyePos = window.GamePlayer.getEyePosition ? window.GamePlayer.getEyePosition() : window.GamePlayer.getPosition(), playerFeetPos = window.GamePlayer.getFeetPosition ? window.GamePlayer.getFeetPosition() : playerEyePos;
      if (wallhackRing && wallhackRing.position.set(playerFeetPos.x, .06, playerFeetPos.z), 
      window.GameWallhack && window.GameWallhack.syncEntities && window.GameWallhack.update && (wallhackDescriptorBuffer.length = 0, 
      window.GameCombatQuery && window.GameCombatQuery.appendWallhackDescriptors && window.GameCombatQuery.appendWallhackDescriptors(wallhackDescriptorBuffer), 
      window.GameWallhack.syncEntities(wallhackDescriptorBuffer), window.GameWallhack.update(camera, playerFeetPos, getCurrentWallhackRadius())), 
      multiplayerMode) {
        window.GameNet.update(dt, playerFeetPos, window.GamePlayer.getRotation()), window.GameThrowables.update(dt, function() {}), 
        window.GameUI.updateThrowableInfo(window.GameThrowables.getState());
        var selfState = window.GameNet.getSelfState();
        if (selfState) {
          var currentClass = window.GameClasses.getCurrentClass();
          !selfState.classId || currentClass && currentClass.id === selfState.classId || applyClassImmediate(selfState.classId), 
          selfState.queuedClassId ? window.GameClasses.queueClass(selfState.queuedClassId) : window.GameClasses.clearQueuedClass && window.GameClasses.clearQueuedClass(), 
          playerHP = selfState.hp, playerMaxHP = selfState.hpMax, playerArmor = selfState.armor, 
          playerArmorMax = selfState.armorMax, window.GameUI.updateHealth(playerHP, playerMaxHP), 
          window.GameUI.updateArmor(playerArmor, playerArmorMax), syncWallhackRingRadius();
        }
        var notice = window.GameNet.consumeNotice();
        notice && setTransientDebug(notice, 900);
      } else window.GameClasses.update(dt, camera, playerEyePos, window.GamePlayer.getRotation(), function(hitData) {
        hitData && hitData.result && handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
      }, setTransientDebug), window.GameEnemy.update(dt, playerEyePos, camera, function(damage, hitType, attackerEnemy) {
        consumePlayerDamage(damage, hitType, attackerEnemy);
      }), window.GameThrowables.update(dt, function(hitData) {
        hitData && hitData.result && handleEnemyHit(hitData.hitPoint, hitData.damage, hitData.hitType, hitData.result);
      }), window.GameUI.updateThrowableInfo(window.GameThrowables.getState()), window.GameUI.updateHealth(playerHP, playerMaxHP), 
      window.GameUI.updateArmor(playerArmor, playerArmorMax);
      currentAimTargetId = "";
      var centerTarget = window.GameHitscan.peekCenterTarget(camera, 220);
      centerTarget && centerTarget.targetId && (currentAimTargetId = centerTarget.targetId), 
      window.GameOverhead.update(camera, playerFeetPos, currentAimTargetId);
      var cdRemaining = window.GameHitscan.cooldownRemaining(), cdTotal = window.GameHitscan.getCooldown(), cdReady = cdRemaining <= 0, cdPct = cdReady ? 1 : 1 - cdRemaining / cdTotal;
      window.GameUI.updateCooldown(cdReady, cdPct), window.GameUI.updateDamageEffects(dt), 
      window.GameUI.updateClassInfo(window.GameClasses.getHudState()), window.GameParticles && window.GameParticles.update && window.GameParticles.update(dt), 
      renderer.render(scene, camera);
    }
  }
  function boot() {
    var runtimeBootCommitted = !1, rt = runtime();
    function showFatalBootError(msg, err) {
      var text = String(msg || "Unknown startup error");
      setBootState("failed", text), writeDebugInfo("Startup error: " + text), console.error("Startup error:", err || text);
    }
    function initRuntimeOnce() {
      return initPromise || (setBootState("initializing"), initPromise = Promise.resolve().then(function() {
        initGame(), (function() {
          if ("failed" !== bootState) {
            if (setBootState("ready"), pendingPlayStart) return pendingPlayStart = !1, lastStartRequest = 0, 
            void requestPlayStart();
          }
        })();
      }).catch(function(err) {
        throw showFatalBootError(err && err.message ? err.message : String(err || "Unknown startup error"), err), 
        err;
      }));
    }
    function beginRuntime(authedUser) {
      if (!runtimeBootCommitted) {
        if (runtimeBootCommitted = !0, !authedUser) return bootWorldManifest = null, startupDebugNotice = "Local dev mode: backend auth/multiplayer disabled.", 
        rt.dispatch("AUTH_SKIP_LOCAL"), void initRuntimeOnce();
        startupDebugNotice = "", window.GameNet && window.GameNet.fetchWorldManifest ? window.GameNet.fetchWorldManifest().then(function(manifest) {
          if (!manifest) throw new Error("world_manifest_missing");
          return bootWorldManifest = manifest, initRuntimeOnce();
        }).catch(function(err) {
          bootWorldManifest = null, showFatalBootError("Cannot start multiplayer: world manifest unavailable (" + (err && err.message ? err.message : "unknown") + ").", err);
        }) : showFatalBootError("Cannot start multiplayer: world manifest API is unavailable.");
      }
    }
    if (rt.init({
      mode: "boot"
    }), window.GameUIShell.init(), setupPointerLock(), setBootState("booting"), ensureRuntimeReady = initRuntimeOnce, 
    !(function() {
      try {
        var params = new URLSearchParams(window.location.search || "");
        if ("1" === params.get("local") || "1" === params.get("offline")) return !0;
        if ("1" === params.get("net")) return !1;
      } catch (err) {}
      return "file:" === window.location.protocol;
    })() && window.GameNet && window.GameNet.requireAuth) return rt.dispatch("AUTH_REQUIRED"), 
    void window.GameNet.requireAuth(function(authedUser) {
      beginRuntime(authedUser || null);
    });
    beginRuntime(null);
  }
  "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
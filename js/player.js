!(function() {
  "use strict";
  var GamePlayer = {}, camera = null, yaw = 0, pitch = 0, PRIM = globalThis.__GAME_PRIMITIVES__ || {}, COMBAT_PRIM = PRIM.combat || {}, COORDS_PRIM = PRIM.coords || {}, ENTITY_PRIM = PRIM.entity || {}, WORLD_PRIM = PRIM.world || {}, EYE_HEIGHT = Number(COORDS_PRIM.eye_offset_y || 1.6), PITCH_LIMIT = Math.PI / 180 * 89, WORLD_MIN = Number(WORLD_PRIM.min || 1), WORLD_MAX = Number(WORLD_PRIM.max || 49), PLAYER_RADIUS = Number(ENTITY_PRIM.capsule_radius || .58), PLAYER_HEIGHT = Number(ENTITY_PRIM.capsule_height || 1.7), playerX = 25, playerZ = 45, velocityY = 0, feetY = 0, isGrounded = !0, jumpHoldTimer = 0, jumpPressedLastFrame = !1, perspectiveMode = "first", thirdCameraInitialized = !1, viewOrigin = new THREE.Vector3, viewDesired = new THREE.Vector3, viewTarget = new THREE.Vector3, viewDir = new THREE.Vector3, plasmaForwardDir = new THREE.Vector3, viewRay = new THREE.Raycaster, keys = {
    forward: !1,
    backward: !1,
    left: !1,
    right: !1,
    jump: !1,
    sprint: !1
  }, weaponGroup = null, weaponParts = {}, muzzleFlash = null, muzzleLight = null, muzzleLightTimer = 0, currentWeaponId = "rifle", tmpMuzzleWorldPos = null, avatarGroup = null, avatarRigApi = null, collisionDebugGroup = null, collisionDebugFeet = null, collisionDebugHead = null, collisionDebugVisible = !0, bobTimer = 0, isMoving = !1, sprinting = !1, lastMoveSpeedNorm = 0, loadoutSlots = (COMBAT_PRIM.weapon_order || [ "rifle" ]).slice(), ignoreNextMouseDelta = !0, MAX_MOUSE_DELTA = 160;
  function hasInputCapture() {
    if (window.GameRuntime && window.GameRuntime.getState) {
      var runtimeState = window.GameRuntime.getState();
      return !!runtimeState.pointerLocked;
    }
    return !1;
  }
  function canAcceptGameplayInput() {
    return window.GameRuntime && window.GameRuntime.canAcceptGameplayInput ? window.GameRuntime.canAcceptGameplayInput() : hasInputCapture();
  }
  function clearMovementKeys() {
    keys.forward = !1, keys.backward = !1, keys.left = !1, keys.right = !1, keys.jump = !1, 
    keys.sprint = !1;
  }
  function onPointerLockGained() {
    ignoreNextMouseDelta = !0;
  }
  function onPointerLockLost() {
    ignoreNextMouseDelta = !0, clearMovementKeys(), jumpPressedLastFrame = !1;
  }
  function updateAvatarAnimation(dt, speed) {
    if (avatarRigApi) {
      var speedNorm = Math.max(0, Math.min(1.4, speed / 11));
      if (avatarRigApi.setMotionState) {
        var strafeOnly = (keys.left || keys.right) && !(keys.forward || keys.backward);
        avatarRigApi.setMotionState({
          speedNorm: speedNorm,
          sprinting: sprinting,
          grounded: isGrounded,
          strafing: strafeOnly
        });
      }
      avatarRigApi.setActionState && avatarRigApi.setActionState({
        aiming: !0,
        firing: !1
      }), avatarRigApi.updateAimPitch && avatarRigApi.updateAimPitch(pitch), avatarRigApi.updatePose ? avatarRigApi.updatePose(dt) : avatarRigApi.updateLocomotion && avatarRigApi.updateLocomotion(speedNorm, sprinting, dt);
    }
  }
  function setPart(mesh, px, py, pz, sx, sy, sz, colorHex) {
    mesh && (mesh.position.set(px, py, pz), mesh.scale.set(sx, sy, sz), "number" == typeof colorHex && mesh.material && mesh.material.color && mesh.material.color.setHex(colorHex));
  }
  function applyWeaponStyle(weaponId) {
    if (!weaponGroup || !weaponParts.body) return !1;
    var style = null;
    return window.GameAvatarRig && window.GameAvatarRig.getWeaponStyle && (style = window.GameAvatarRig.getWeaponStyle(weaponId)), 
    !!(style && style.body && style.barrel && style.stock && style.grip) && (currentWeaponId = weaponId, 
    setPart(weaponParts.body, style.body.p[0], style.body.p[1], style.body.p[2], style.body.s[0], style.body.s[1], style.body.s[2], style.body.c), 
    setPart(weaponParts.barrel, style.barrel.p[0], style.barrel.p[1], style.barrel.p[2], style.barrel.s[0], style.barrel.s[1], style.barrel.s[2], style.barrel.c), 
    setPart(weaponParts.stock, style.stock.p[0], style.stock.p[1], style.stock.p[2], style.stock.s[0], style.stock.s[1], style.stock.s[2], style.stock.c), 
    setPart(weaponParts.grip, style.grip.p[0], style.grip.p[1], style.grip.p[2], style.grip.s[0], style.grip.s[1], style.grip.s[2], style.grip.c), 
    weaponParts.scope && (weaponParts.scope.visible = !!style.scope), weaponParts.pump && (weaponParts.pump.visible = !!style.pump), 
    weaponParts.drum && (weaponParts.drum.visible = !!style.coil), muzzleFlash && style.muzzlePos && muzzleFlash.position.set(style.muzzlePos[0], style.muzzlePos[1], style.muzzlePos[2]), 
    avatarRigApi && avatarRigApi.setWeapon && avatarRigApi.setWeapon(currentWeaponId), 
    !0);
  }
  function getWorldBounds() {
    return window.GameWorld && window.GameWorld.getBounds ? window.GameWorld.getBounds() : {
      min: WORLD_MIN,
      max: WORLD_MAX
    };
  }
  function getDefaultSpawnPoint() {
    return window.GameWorld.getSafeSpawn({
      padding: window.GameWorld.getSpawnPadding(),
      tries: 120,
      feetY: 0,
      height: PLAYER_HEIGHT,
      radius: PLAYER_RADIUS
    });
  }
  function getCollisionBoxes() {
    if (!window.GameWorld || !window.GameWorld.getCollidables) return [];
    var meshes = window.GameWorld.getCollidables();
    if (!meshes || 0 === meshes.length) return [];
    for (var boxes = [], i = 0; i < meshes.length; i++) {
      var mesh = meshes[i];
      if (mesh) {
        mesh.userData || (mesh.userData = {});
        var box = mesh.userData.collisionBox;
        box || (mesh.updateMatrixWorld(!0), box = (new THREE.Box3).setFromObject(mesh), 
        mesh.userData.collisionBox = box), boxes.push(box);
      }
    }
    return boxes;
  }
  function intersectsXZ(x, z, radius, box) {
    var dx = x - Math.max(box.min.x, Math.min(x, box.max.x)), dz = z - Math.max(box.min.z, Math.min(z, box.max.z));
    return dx * dx + dz * dz < radius * radius;
  }
  function isBlockedAt(nextX, nextZ, feetY) {
    if (window.GameWorld && window.GameWorld.isPointBlocked) return !!window.GameWorld.isPointBlocked(nextX, nextZ, {
      feetY: feetY,
      height: PLAYER_HEIGHT,
      radius: PLAYER_RADIUS
    });
    var boxes = getCollisionBoxes();
    if (0 === boxes.length) return !1;
    for (var headY = feetY + PLAYER_HEIGHT, i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (!(headY <= box.min.y + .001 || feetY >= box.max.y - .001) && intersectsXZ(nextX, nextZ, PLAYER_RADIUS, box)) return !0;
    }
    return !1;
  }
  function recoverFromOverlap(maxIterations) {
    if (!window.GameWorld || !window.GameWorld.resolveCapsulePenetration) return null;
    var result = window.GameWorld.resolveCapsulePenetration({
      x: playerX,
      z: playerZ,
      feetY: feetY,
      height: PLAYER_HEIGHT,
      radius: PLAYER_RADIUS
    }, {
      maxIterations: maxIterations || 10
    });
    return result ? ("number" == typeof result.x && (playerX = result.x), "number" == typeof result.z && (playerZ = result.z), 
    result) : null;
  }
  function enforceValidSpawnInvariant() {
    if (window.GameWorld && window.GameWorld.validateSpawn) {
      var check = window.GameWorld.validateSpawn({
        x: playerX,
        z: playerZ,
        feetY: feetY,
        height: PLAYER_HEIGHT,
        radius: PLAYER_RADIUS
      });
      if ((!check || !check.valid) && window.GameWorld.getSafeSpawn) {
        var safe = window.GameWorld.getSafeSpawn({
          padding: window.GameWorld.getSpawnPadding ? window.GameWorld.getSpawnPadding() : 8,
          tries: 120,
          feetY: feetY,
          height: PLAYER_HEIGHT,
          radius: PLAYER_RADIUS
        });
        playerX = safe.x, playerZ = safe.z, recoverFromOverlap(16);
      }
    }
  }
  function updateAvatarPose() {
    avatarGroup && (avatarGroup.position.set(playerX, feetY, playerZ), avatarGroup.rotation.y = yaw + Math.PI, 
    collisionDebugGroup && (collisionDebugGroup.visible = !!collisionDebugVisible, collisionDebugFeet.position.set(playerX, feetY + .04, playerZ), 
    collisionDebugHead.position.set(playerX, feetY + PLAYER_HEIGHT, playerZ)));
  }
  function updateCameraFromPlayer(dt) {
    if (camera) {
      var eyeY = feetY + EYE_HEIGHT, cosPitch = Math.cos(pitch), forwardX = -Math.sin(yaw) * cosPitch, forwardY = Math.sin(pitch), forwardZ = -Math.cos(yaw) * cosPitch, rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
      if ("first" === perspectiveMode) return weaponGroup && (weaponGroup.visible = !0), 
      avatarGroup && (avatarGroup.visible = !1), camera.position.set(playerX, eyeY, playerZ), 
      camera.rotation.order = "YXZ", camera.rotation.y = yaw, camera.rotation.x = pitch, 
      void (thirdCameraInitialized = !1);
      weaponGroup && (weaponGroup.visible = !1), avatarGroup && (avatarGroup.visible = !0), 
      updateAvatarPose(), viewOrigin.set(playerX, eyeY + .3, playerZ), viewTarget.set(playerX + 20 * forwardX, eyeY + 20 * forwardY, playerZ + 20 * forwardZ), 
      viewDesired.set(playerX + 1.35 * rightX - 4.4 * forwardX, eyeY + .7, playerZ + 1.35 * rightZ - 4.4 * forwardZ);
      var worldMeshes = window.GameWorld && window.GameWorld.getCollidables ? window.GameWorld.getCollidables() : [];
      if (worldMeshes && worldMeshes.length > 0) {
        viewDir.copy(viewDesired).sub(viewOrigin);
        var dist = viewDir.length();
        if (dist > .001) {
          viewDir.divideScalar(dist), viewRay.set(viewOrigin, viewDir), viewRay.far = dist;
          var hits = viewRay.intersectObjects(worldMeshes, !1);
          if (hits.length > 0) {
            var safeDist = Math.max(.8, hits[0].distance - .2);
            viewDesired.copy(viewOrigin).addScaledVector(viewDir, safeDist);
          }
        }
      }
      thirdCameraInitialized ? camera.position.lerp(viewDesired, Math.min(1, 12 * dt)) : (camera.position.copy(viewDesired), 
      thirdCameraInitialized = !0), camera.lookAt(viewTarget);
    }
  }
  function setupInput() {
    document.addEventListener("keydown", function(e) {
      if (!(function(e) {
        return !(!e || !(function(el) {
          if (!el) return !1;
          var tag = (el.tagName || "").toUpperCase();
          return !!el.isContentEditable || "INPUT" === tag || "TEXTAREA" === tag || "SELECT" === tag;
        })(e.target) && !(window.GameUIShell && window.GameUIShell.isTextInputFocused && window.GameUIShell.isTextInputFocused()));
      })(e) && canAcceptGameplayInput()) switch (e.code) {
       case "KeyW":
        keys.forward = !0;
        break;

       case "KeyA":
        keys.left = !0;
        break;

       case "KeyS":
        keys.backward = !0;
        break;

       case "KeyD":
        keys.right = !0;
        break;

       case "ShiftLeft":
       case "ShiftRight":
        keys.sprint = !0;
        break;

       case "Space":
        keys.jump = !0, e.preventDefault();
      }
    }), document.addEventListener("keyup", function(e) {
      switch (e.code) {
       case "KeyW":
        keys.forward = !1;
        break;

       case "KeyA":
        keys.left = !1;
        break;

       case "KeyS":
        keys.backward = !1;
        break;

       case "KeyD":
        keys.right = !1;
        break;

       case "ShiftLeft":
       case "ShiftRight":
        keys.sprint = !1;
        break;

       case "Space":
        keys.jump = !1;
      }
    }), document.addEventListener("mousemove", function(e) {
      if (hasInputCapture()) {
        if (ignoreNextMouseDelta) return void (ignoreNextMouseDelta = !1);
        var dx = e.movementX || 0, dy = e.movementY || 0;
        dx > MAX_MOUSE_DELTA ? dx = MAX_MOUSE_DELTA : dx < -MAX_MOUSE_DELTA && (dx = -MAX_MOUSE_DELTA), 
        dy > MAX_MOUSE_DELTA ? dy = MAX_MOUSE_DELTA : dy < -MAX_MOUSE_DELTA && (dy = -MAX_MOUSE_DELTA), 
        yaw -= .002 * dx, pitch -= .002 * dy, pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
      }
    }), window.addEventListener("resize", function() {
      camera && (camera.aspect = window.innerWidth / window.innerHeight, camera.updateProjectionMatrix());
    }), window.addEventListener("blur", function() {
      onPointerLockLost();
    }), document.addEventListener("pointerlockchange", function() {
      hasInputCapture() ? onPointerLockGained() : onPointerLockLost();
    });
  }
  function setSpawnPosition(x, z, spawnFeetY) {
    return !!camera && (playerX = x, playerZ = z, velocityY = 0, feetY = "number" == typeof (nextFeetY = spawnFeetY = "number" == typeof spawnFeetY ? spawnFeetY : 0) ? nextFeetY : 0, 
    isGrounded = !0, jumpHoldTimer = 0, recoverFromOverlap(14), enforceValidSpawnInvariant(), 
    updateAvatarPose(), updateCameraFromPlayer(1), !0);
    var nextFeetY;
  }
  GamePlayer.init = function(scene) {
    var bounds = getWorldBounds(), worldSpan = "number" == typeof bounds.size ? bounds.size : bounds.max - bounds.min, cameraFar = Math.max(120, 2.2 * worldSpan);
    (camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, .1, cameraFar)).rotation.order = "YXZ", 
    scene.add(camera);
    var spawn = getDefaultSpawnPoint();
    playerX = spawn.x, playerZ = spawn.z, feetY = 0, recoverFromOverlap(16), enforceValidSpawnInvariant(), 
    weaponGroup = new THREE.Group, weaponParts = {};
    var darkMat = new THREE.MeshLambertMaterial({
      color: 4473924
    }), darkerMat = new THREE.MeshLambertMaterial({
      color: 3355443
    }), woodMat = new THREE.MeshLambertMaterial({
      color: 9132587
    }), metalMat = new THREE.MeshLambertMaterial({
      color: 6710886
    });
    weaponParts.body = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .5), darkMat), 
    weaponParts.barrel = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .3), darkerMat), 
    weaponParts.stock = new THREE.Mesh(new THREE.BoxGeometry(.06, .1, .15), woodMat), 
    weaponParts.grip = new THREE.Mesh(new THREE.BoxGeometry(.05, .12, .06), woodMat), 
    weaponParts.scope = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .2), metalMat), 
    weaponParts.scope.position.set(0, .08, -.22), weaponParts.scope.visible = !1, weaponParts.pump = new THREE.Mesh(new THREE.BoxGeometry(.08, .06, .12), woodMat), 
    weaponParts.pump.position.set(0, -.03, -.36), weaponParts.pump.visible = !1, weaponParts.drum = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .08), metalMat), 
    weaponParts.drum.position.set(0, -.11, -.11), weaponParts.drum.visible = !1, (muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(.06, 4, 4), new THREE.MeshBasicMaterial({
      color: 16777164,
      transparent: !0,
      opacity: 1
    }))).visible = !1, (muzzleLight = new THREE.PointLight(16764006, 0, 4)).position.copy(muzzleFlash.position), 
    weaponGroup.add(muzzleLight), tmpMuzzleWorldPos = new THREE.Vector3, weaponGroup.add(weaponParts.body), 
    weaponGroup.add(weaponParts.barrel), weaponGroup.add(weaponParts.stock), weaponGroup.add(weaponParts.grip), 
    weaponGroup.add(weaponParts.scope), weaponGroup.add(weaponParts.pump), weaponGroup.add(weaponParts.drum), 
    weaponGroup.add(muzzleFlash);
    var armMat = new THREE.MeshLambertMaterial({
      color: 13805437
    }), rightArm = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .28), armMat);
    rightArm.position.set(0, -.12, -.05), weaponGroup.add(rightArm);
    var leftArm = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .22), armMat);
    leftArm.position.set(-.06, -.06, -.22), leftArm.rotation.y = .2, weaponGroup.add(leftArm), 
    weaponGroup.position.set(.25, -.2, -.4), camera.add(weaponGroup);
    var avatarModel = (function() {
      if (!window.GameAvatarRig || !window.GameAvatarRig.create) throw new Error("GameAvatarRig is required for canonical avatar rendering.");
      var shared = window.GameAvatarRig.create("player", {
        bodyColor: 4882369,
        skinColor: 13805437,
        legColor: 3092271,
        weaponId: currentWeaponId
      });
      return {
        model: shared.root,
        rigApi: shared
      };
    })();
    return avatarGroup = avatarModel.model, avatarRigApi = avatarModel.rigApi || null, 
    scene.add(avatarGroup), collisionDebugGroup = new THREE.Group, (collisionDebugFeet = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshBasicMaterial({
      color: 8190463,
      transparent: !0,
      opacity: .85,
      depthTest: !1
    }))).renderOrder = 50, (collisionDebugHead = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshBasicMaterial({
      color: 16755302,
      transparent: !0,
      opacity: .85,
      depthTest: !1
    }))).renderOrder = 50, collisionDebugGroup.add(collisionDebugFeet), collisionDebugGroup.add(collisionDebugHead), 
    scene.add(collisionDebugGroup), applyWeaponStyle("rifle"), setupInput(), updateAvatarPose(), 
    updateCameraFromPlayer(1), camera;
  }, GamePlayer.update = function(dt) {
    if (camera) {
      if (!canAcceptGameplayInput()) return clearMovementKeys(), jumpPressedLastFrame = !1, 
      lastMoveSpeedNorm = 0, isMoving = !1, sprinting = !1, updateAvatarPose(), updateAvatarAnimation(dt, 0), 
      void updateCameraFromPlayer(dt);
      var jumpJustPressed = keys.jump && !jumpPressedLastFrame, jumpJustReleased = !keys.jump && jumpPressedLastFrame;
      jumpPressedLastFrame = keys.jump;
      var forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw), rightX = Math.cos(yaw), rightZ = -Math.sin(yaw), speedCap = keys.sprint ? 11 : 8, moveX = 0, moveZ = 0;
      keys.forward && (moveX += forwardX, moveZ += forwardZ), keys.backward && (moveX -= forwardX, 
      moveZ -= forwardZ), keys.left && (moveX -= rightX, moveZ -= rightZ), keys.right && (moveX += rightX, 
      moveZ += rightZ);
      var length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      length > 0 ? (moveX = moveX / length * speedCap * dt, moveZ = moveZ / length * speedCap * dt) : (moveX = 0, 
      moveZ = 0);
      var bounds = getWorldBounds(), currentFeetY = feetY, minBound = bounds.min + PLAYER_RADIUS, maxBound = bounds.max - PLAYER_RADIUS, startX = playerX, startZ = playerZ, nextX = playerX + moveX;
      isBlockedAt(nextX = Math.max(minBound, Math.min(maxBound, nextX)), playerZ, currentFeetY) || (playerX = nextX);
      var nextZ = playerZ + moveZ;
      nextZ = Math.max(minBound, Math.min(maxBound, nextZ)), isBlockedAt(playerX, nextZ, currentFeetY) || (playerZ = nextZ);
      var movedX = playerX - startX, movedZ = playerZ - startZ, horizontalSpeed = Math.sqrt(movedX * movedX + movedZ * movedZ) / Math.max(dt, 1e-4);
      lastMoveSpeedNorm = Math.max(0, Math.min(1.4, horizontalSpeed / 11)), sprinting = (isMoving = horizontalSpeed > .06) && keys.sprint, 
      jumpJustPressed && isGrounded && (velocityY = 8.8, isGrounded = !1, jumpHoldTimer = .2), 
      jumpJustReleased && velocityY > 0 && (velocityY *= .42, jumpHoldTimer = 0), keys.jump && jumpHoldTimer > 0 && velocityY > 0 && (velocityY += 16 * dt, 
      (jumpHoldTimer -= dt) < 0 && (jumpHoldTimer = 0));
      var nextFeetY = currentFeetY + (velocityY -= 18 * dt) * dt;
      if (velocityY <= 0) {
        var landingY = (function(x, z, currentFeetY, nextFeetY) {
          var boxes = getCollisionBoxes();
          if (0 === boxes.length) return 0;
          for (var best = null, i = 0; i < boxes.length; i++) {
            var box = boxes[i], top = box.max.y;
            intersectsXZ(x, z, .9 * PLAYER_RADIUS, box) && top <= currentFeetY + .001 && top >= nextFeetY - .001 && (null === best || top > best) && (best = top);
          }
          return null === best || best < 0 ? 0 : best;
        })(playerX, playerZ, currentFeetY, nextFeetY);
        nextFeetY <= landingY + .001 ? (nextFeetY = landingY, velocityY = 0, isGrounded = !0, 
        jumpHoldTimer = 0) : isGrounded = !1;
      } else {
        var nextHeadY = nextFeetY + PLAYER_HEIGHT, ceilingY = (function(x, z, currentHeadY, nextHeadY) {
          var boxes = getCollisionBoxes();
          if (0 === boxes.length) return null;
          for (var best = null, i = 0; i < boxes.length; i++) {
            var box = boxes[i], bottom = box.min.y;
            intersectsXZ(x, z, .9 * PLAYER_RADIUS, box) && bottom >= currentHeadY - .001 && bottom <= nextHeadY + .001 && (null === best || bottom < best) && (best = bottom);
          }
          return best;
        })(playerX, playerZ, currentFeetY + PLAYER_HEIGHT, nextHeadY);
        null !== ceilingY && nextHeadY >= ceilingY - .001 && (nextFeetY = ceilingY - PLAYER_HEIGHT, 
        velocityY = 0, jumpHoldTimer = 0), isGrounded = !1;
      }
      nextFeetY < 0 && (nextFeetY = 0, velocityY = 0, isGrounded = !0, jumpHoldTimer = 0), 
      feetY = nextFeetY;
      var depenetration = recoverFromOverlap(6);
      depenetration && depenetration.hadOverlap && depenetration.resolved && (isGrounded = !0), 
      updateAvatarPose(), updateAvatarAnimation(dt, horizontalSpeed), updateCameraFromPlayer(dt), 
      weaponGroup && weaponGroup.visible && (isMoving && isGrounded ? (bobTimer += 10 * dt, 
      weaponGroup.position.y = .015 * Math.sin(bobTimer) - .2, weaponGroup.position.x = .25 + .008 * Math.cos(.5 * bobTimer)) : (weaponGroup.position.y += (-.2 - weaponGroup.position.y) * dt * 5, 
      weaponGroup.position.x += (.25 - weaponGroup.position.x) * dt * 5)), muzzleLight && muzzleLightTimer > 0 && ((muzzleLightTimer -= dt) <= 0 ? (muzzleLightTimer = 0, 
      muzzleLight.intensity = 0) : muzzleLight.intensity = muzzleLightTimer / .06 * 2.5);
    }
  }, GamePlayer.fireAnimation = function() {
    if (weaponGroup) {
      avatarRigApi && avatarRigApi.setActionState && avatarRigApi.setActionState({
        firing: !0,
        aiming: !0
      });
      var recoilByWeapon = {
        pistol: {
          z: -.355,
          x: -.06,
          returnMs: 120
        },
        rifle: {
          z: -.35,
          x: -.08,
          returnMs: 150
        },
        machinegun: {
          z: -.365,
          x: -.06,
          returnMs: 95
        },
        shotgun: {
          z: -.33,
          x: -.12,
          returnMs: 230
        },
        sniper: {
          z: -.31,
          x: -.13,
          returnMs: 280
        },
        plasma: {
          z: -.36,
          x: -.03,
          returnMs: 80
        }
      }, recoil = recoilByWeapon[currentWeaponId] || recoilByWeapon.rifle;
      if (weaponGroup.position.z = recoil.z, weaponGroup.rotation.x = recoil.x, muzzleFlash) {
        if (muzzleFlash.visible = !0, muzzleFlash.scale.set(1, 1, 1), muzzleFlash.material.opacity = 1, 
        muzzleLight && (muzzleLight.intensity = 2.5, muzzleLight.position.copy(muzzleFlash.position), 
        muzzleLightTimer = .06), window.GameParticles && window.GameParticles.spawn) {
          muzzleFlash.getWorldPosition(tmpMuzzleWorldPos);
          var sparkCount = "shotgun" === currentWeaponId ? 6 : 4;
          window.GameParticles.burst(tmpMuzzleWorldPos, sparkCount, {
            color: [ 16768324, 16755234, 16764006, 16777215 ],
            speedRange: [ 3, 8 ],
            scaleRange: [ .02, .05 ],
            lifeRange: [ .05, .12 ],
            gravity: .3,
            drag: .2
          });
        }
        var flashDur = "sniper" === currentWeaponId ? 90 : 60, flashStart = performance.now();
        function flashFade() {
          var elapsed = performance.now() - flashStart, t = Math.min(1, elapsed / flashDur);
          muzzleFlash.scale.setScalar(1 + 1.5 * t), muzzleFlash.material.opacity = 1 - t, 
          t < 1 ? requestAnimationFrame(flashFade) : (muzzleFlash.visible = !1, muzzleFlash.scale.set(1, 1, 1), 
          muzzleFlash.material.opacity = 1);
        }
        requestAnimationFrame(flashFade);
      }
      var startTime = performance.now();
      requestAnimationFrame(function recoilReturn() {
        var elapsed = performance.now() - startTime, t = Math.min(1, elapsed / recoil.returnMs);
        weaponGroup.position.z = recoil.z + (-.4 - recoil.z) * t, weaponGroup.rotation.x = recoil.x * (1 - t), 
        t < 1 && requestAnimationFrame(recoilReturn);
      });
    }
  }, GamePlayer.togglePerspective = function() {
    return perspectiveMode = "first" === perspectiveMode ? "third" : "first", thirdCameraInitialized = !1, 
    updateCameraFromPlayer(1), perspectiveMode;
  }, GamePlayer.setPerspective = function(mode) {
    return "first" !== mode && "third" !== mode || (perspectiveMode = mode, thirdCameraInitialized = !1, 
    updateCameraFromPlayer(1)), perspectiveMode;
  }, GamePlayer.getPerspective = function() {
    return perspectiveMode;
  }, GamePlayer.setWeaponModel = function(weaponId) {
    return applyWeaponStyle(weaponId);
  }, GamePlayer.getCamera = function() {
    return camera;
  }, GamePlayer.getPosition = function() {
    return GamePlayer.getEyePosition();
  }, GamePlayer.getFeetPosition = function() {
    return new THREE.Vector3(playerX, feetY, playerZ);
  }, GamePlayer.getEyePosition = function() {
    return new THREE.Vector3(playerX, feetY + EYE_HEIGHT, playerZ);
  }, GamePlayer.getRotation = function() {
    return {
      yaw: yaw,
      pitch: pitch
    };
  }, GamePlayer.getMuzzleWorldPos = function() {
    return muzzleFlash ? (tmpMuzzleWorldPos || (tmpMuzzleWorldPos = new THREE.Vector3), 
    muzzleFlash.getWorldPosition(tmpMuzzleWorldPos), tmpMuzzleWorldPos) : null;
  }, GamePlayer.getMuzzleWorldPosition = function() {
    return "third" === perspectiveMode && avatarRigApi && avatarRigApi.getMuzzleWorldPosition ? avatarRigApi.getMuzzleWorldPosition() : camera ? (camera.getWorldDirection(plasmaForwardDir), 
    camera.position.clone().addScaledVector(plasmaForwardDir, .65)) : null;
  }, GamePlayer.getEquippedWeaponId = function() {
    return currentWeaponId;
  }, GamePlayer.getAnimNetState = function() {
    var rigAnim = avatarRigApi && avatarRigApi.getAnimState ? avatarRigApi.getAnimState() : null;
    return {
      moveSpeedNorm: lastMoveSpeedNorm,
      sprinting: !!sprinting,
      aimPitch: pitch,
      equippedWeaponId: currentWeaponId,
      animState: rigAnim ? rigAnim.animState : isMoving ? sprinting ? "sprint" : "run" : "idle",
      animPhase: rigAnim ? rigAnim.animPhase : 0,
      gripMode: rigAnim ? rigAnim.gripMode : "pistol" === currentWeaponId ? "one_hand" : "two_hand"
    };
  }, GamePlayer.setLoadout = function(loadoutConfig) {
    if (!loadoutConfig || !Array.isArray(loadoutConfig.slots)) return {
      slots: loadoutSlots.slice()
    };
    var allowed = {}, hasAllowed = !1;
    if (window.GameHitscan && window.GameHitscan.getAllWeaponIds) for (var ids = window.GameHitscan.getAllWeaponIds(), n = 0; n < ids.length; n++) allowed[ids[n]] = !0, 
    hasAllowed = !0;
    for (var next = [], seen = {}, i = 0; i < loadoutConfig.slots.length; i++) {
      var id = String(loadoutConfig.slots[i] || "");
      id && !seen[id] && (hasAllowed && !allowed[id] || (seen[id] = !0, next.push(id)));
    }
    return next.length > 0 && (loadoutSlots = next), {
      slots: loadoutSlots.slice()
    };
  }, GamePlayer.getLoadout = function() {
    return {
      slots: loadoutSlots.slice()
    };
  }, GamePlayer.equipSlot = function(slotIndex) {
    var idx = Math.max(0, Math.floor(slotIndex || 0));
    return idx >= loadoutSlots.length ? null : loadoutSlots[idx];
  }, GamePlayer.respawn = function(x, z) {
    if (!camera) return !1;
    var safe = getDefaultSpawnPoint();
    return setSpawnPosition("number" == typeof x ? x : safe.x, "number" == typeof z ? z : safe.z, 0);
  }, GamePlayer.respawnRandom = function() {
    return camera && GamePlayer.respawn() ? new THREE.Vector2(playerX, playerZ) : null;
  }, GamePlayer.spawnSafe = function() {
    if (!camera) return null;
    var spawn = getDefaultSpawnPoint();
    return setSpawnPosition(spawn.x, spawn.z, 0), new THREE.Vector2(spawn.x, spawn.z);
  }, GamePlayer.recoverFromOverlap = function() {
    var out = recoverFromOverlap(16);
    return updateAvatarPose(), updateCameraFromPlayer(1), out;
  }, GamePlayer.getInputStateDebug = function() {
    return {
      capture: hasInputCapture(),
      canAcceptGameplayInput: canAcceptGameplayInput(),
      keys: {
        forward: !!keys.forward,
        backward: !!keys.backward,
        left: !!keys.left,
        right: !!keys.right,
        jump: !!keys.jump,
        sprint: !!keys.sprint
      }
    };
  }, GamePlayer.applyServerReconcile = function(state) {
    if (state && "object" == typeof state && camera) {
      var sx = "number" == typeof state.x ? state.x : playerX, sy = "number" == typeof state.feetY ? state.feetY : feetY, sz = "number" == typeof state.z ? state.z : playerZ, dx = sx - playerX, dz = sz - playerZ;
      if (Math.sqrt(dx * dx + dz * dz) > 1.6) playerX = sx, playerZ = sz, feetY = sy; else {
        playerX += .55 * dx, playerZ += .55 * dz, feetY += .55 * (sy - feetY);
      }
      "number" == typeof state.velY && (velocityY = state.velY), "boolean" == typeof state.grounded && (isGrounded = state.grounded), 
      "number" == typeof state.yaw && (yaw = state.yaw), "number" == typeof state.pitch && (pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.pitch))), 
      recoverFromOverlap(4), updateAvatarPose(), updateCameraFromPlayer(.016);
    }
  }, GamePlayer.setCollisionDebugVisible = function(visible) {
    collisionDebugVisible = !!visible, collisionDebugGroup && (collisionDebugGroup.visible = collisionDebugVisible);
  }, GamePlayer.onPointerLockGained = function() {
    onPointerLockGained();
  }, GamePlayer.onPointerLockLost = function() {
    onPointerLockLost();
  }, window.GamePlayer = GamePlayer;
})();
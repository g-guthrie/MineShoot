/**
 * player-combat.js - Player combat state (HP, armor, damage, respawn)
 * Extracted from main.js to isolate player combat concerns.
 */
(function () {
    'use strict';

    var RT = globalThis.__MAYHEM_RUNTIME;

    var playerHP = 500;
    var playerMaxHP = 500;
    var playerArmor = 90;
    var playerArmorMax = 90;
    var armorRegenDelay = 0;
    var respawnInvulnTimer = 0;

    var DEFAULT_ARMOR_REGEN_DELAY = 6.0;
    var ARMOR_REGEN_PER_SEC = 12;

    var sharedDamageMod = (RT.GameShared && RT.GameShared.damage) || null;

    var _isPlayingFn = null;
    var _isMultiplayerFn = null;

    function isPlaying() {
        return _isPlayingFn ? _isPlayingFn() : false;
    }

    function isMultiplayer() {
        return _isMultiplayerFn ? _isMultiplayerFn() : false;
    }

    function init(opts) {
        if (opts) {
            if (typeof opts.isPlaying === 'function') _isPlayingFn = opts.isPlaying;
            if (typeof opts.isMultiplayer === 'function') _isMultiplayerFn = opts.isMultiplayer;
        }
        sharedDamageMod = (RT.GameShared && RT.GameShared.damage) || null;
        playerHP = playerMaxHP;
        playerArmor = playerArmorMax;
        armorRegenDelay = 0;
        respawnInvulnTimer = 0;
    }

    function consumeDamage(rawDamage, hitType, attackerEnemy) {
        if (respawnInvulnTimer > 0 || !isPlaying()) return;

        var damage = Math.max(1, Math.round(rawDamage));
        var playerTarget = { hp: playerHP, armor: playerArmor, armorMax: playerArmorMax, armorRegenDelay: armorRegenDelay };
        if (sharedDamageMod && sharedDamageMod.applyDamage) {
            var result = sharedDamageMod.applyDamage(playerTarget, damage);
            playerHP = playerTarget.hp;
            playerArmor = playerTarget.armor;
            armorRegenDelay = playerTarget.armorRegenDelay;
            if (result.hpLost > 0 && RT.GameAudio && RT.GameAudio.play) {
                RT.GameAudio.play('playerHit');
            }
        } else {
            armorRegenDelay = DEFAULT_ARMOR_REGEN_DELAY;
            if (playerArmor > 0) {
                var absorbed = Math.min(playerArmor, damage);
                playerArmor -= absorbed;
                damage -= absorbed;
            }
            if (damage > 0) {
                playerHP -= damage;
                if (RT.GameAudio && RT.GameAudio.play) {
                    RT.GameAudio.play('playerHit');
                }
            }
        }

        if (attackerEnemy && attackerEnemy.group && attackerEnemy.group.position) {
            var playerPos = RT.GamePlayer.getPosition();
            var rot = RT.GamePlayer.getRotation();
            RT.GameUI.showDirectionalDamage(
                attackerEnemy.group.position,
                playerPos,
                rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
                rawDamage
            );
        }

        if (RT.GameEvents) {
            RT.GameEvents.emit(RT.GameEvents.PLAYER_DAMAGED, {
                damage: damage,
                hitType: hitType,
                hp: playerHP,
                armor: playerArmor
            });
        }

        if (playerHP <= 0) {
            if (RT.GameAbilities && RT.GameAbilities.clearTransientState) {
                RT.GameAbilities.clearTransientState();
            }
            respawn();
            return;
        }

        RT.GameUI.updateHealth(playerHP, playerMaxHP);
        RT.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function respawn() {
        if (RT.GameAbilities && RT.GameAbilities.clearTransientState) {
            RT.GameAbilities.clearTransientState();
        }
        playerHP = playerMaxHP;
        if (!isMultiplayer()) {
            playerArmor = playerArmorMax;
        }
        armorRegenDelay = 0;

        RT.GameUI.updateHealth(playerHP, playerMaxHP);
        RT.GameUI.updateArmor(playerArmor, playerArmorMax);

        if (!isMultiplayer()) {
            RT.GamePlayer.respawnRandom();
            respawnInvulnTimer = 1.0;
        }

        RT.GameUI.updateDamageEffects(5);
        RT.GameUI.updateAbilityInfo(RT.GameAbilities.getHudState());
    }

    function applyArmorProfile(armorMax) {
        armorMax = Math.max(1, armorMax || 100);
        playerArmorMax = armorMax;
        if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
        if (playerArmor < 0) playerArmor = 0;
        RT.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function tickArmorRegen(dt) {
        if (isMultiplayer()) return;
        var regenTarget = { armor: playerArmor, armorMax: playerArmorMax, armorRegenDelay: armorRegenDelay };
        if (sharedDamageMod && sharedDamageMod.tickArmorRegen) {
            sharedDamageMod.tickArmorRegen(regenTarget, dt);
        } else {
            if (regenTarget.armorRegenDelay > 0) {
                regenTarget.armorRegenDelay -= dt;
                if (regenTarget.armorRegenDelay < 0) regenTarget.armorRegenDelay = 0;
            } else if (regenTarget.armor < regenTarget.armorMax) {
                regenTarget.armor += ARMOR_REGEN_PER_SEC * dt;
                if (regenTarget.armor > regenTarget.armorMax) regenTarget.armor = regenTarget.armorMax;
            }
        }
        playerArmor = regenTarget.armor;
        armorRegenDelay = regenTarget.armorRegenDelay;
    }

    function syncFromNetwork(selfState) {
        if (!selfState) return;
        playerHP = selfState.hp;
        playerMaxHP = selfState.hpMax;
        playerArmor = selfState.armor;
        playerArmorMax = selfState.armorMax;
        RT.GameUI.updateHealth(playerHP, playerMaxHP);
        RT.GameUI.updateArmor(playerArmor, playerArmorMax);
    }

    function heal(amount) {
        var value = Math.max(0, Math.round(Number(amount || 0)));
        if (value <= 0) return 0;
        var prev = playerHP;
        playerHP = Math.min(playerMaxHP, playerHP + value);
        RT.GameUI.updateHealth(playerHP, playerMaxHP);
        return Math.max(0, playerHP - prev);
    }

    function showIncomingFeedback(sourcePos, rawDamage, hitType) {
        if (RT.GameAudio && RT.GameAudio.play) {
            RT.GameAudio.play('playerHit');
        }
        if (sourcePos && RT.GamePlayer && RT.GamePlayer.getPosition && RT.GamePlayer.getRotation) {
            var playerPos = RT.GamePlayer.getPosition();
            var rot = RT.GamePlayer.getRotation();
            RT.GameUI.showDirectionalDamage(
                sourcePos,
                playerPos,
                rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
                rawDamage
            );
        }
    }

    RT.GamePlayerCombat = {
        init: init,
        getHP: function () { return playerHP; },
        getMaxHP: function () { return playerMaxHP; },
        getArmor: function () { return playerArmor; },
        getArmorMax: function () { return playerArmorMax; },
        setHP: function (hp) { playerHP = hp; },
        setMaxHP: function (hp) { playerMaxHP = hp; },
        setArmor: function (armor) { playerArmor = armor; },
        setArmorMax: function (armorMax) { playerArmorMax = armorMax; },
        consumeDamage: consumeDamage,
        respawn: respawn,
        applyArmorProfile: applyArmorProfile,
        heal: heal,
        showIncomingFeedback: showIncomingFeedback,
        tickArmorRegen: tickArmorRegen,
        isInvulnerable: function () { return respawnInvulnTimer > 0; },
        setInvulnTimer: function (t) { respawnInvulnTimer = Math.max(0, t); },
        tickInvulnTimer: function (dt) {
            if (respawnInvulnTimer > 0) {
                respawnInvulnTimer -= dt;
                if (respawnInvulnTimer < 0) respawnInvulnTimer = 0;
            }
        },
        syncFromNetwork: syncFromNetwork
    };
})();

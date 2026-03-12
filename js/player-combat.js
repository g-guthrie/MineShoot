import { applyDamage, tickArmorRegen } from '../shared/damage.js';
import { GameUI } from './ui.js';
import { GameAudio } from './audio.js';
import { GamePlayer } from './player.js';

/**
 * player-combat.js - Player combat state (HP, armor, damage, respawn)
 */

export const GamePlayerCombat = {};

let playerHP = 500;
let playerMaxHP = 500;
let playerArmor = 90;
let playerArmorMax = 90;
let armorRegenDelay = 0;
let respawnInvulnTimer = 0;

let isPlayingFn = null;
let isMultiplayerFn = null;

function getPlayerApi() {
  return GamePlayer;
}

function isPlaying() {
  return isPlayingFn ? isPlayingFn() : false;
}

function isMultiplayer() {
  return isMultiplayerFn ? isMultiplayerFn() : false;
}

GamePlayerCombat.init = function init(options) {
  if (options) {
    if (typeof options.isPlaying === 'function') isPlayingFn = options.isPlaying;
    if (typeof options.isMultiplayer === 'function') isMultiplayerFn = options.isMultiplayer;
  }
  playerHP = playerMaxHP;
  playerArmor = playerArmorMax;
  armorRegenDelay = 0;
  respawnInvulnTimer = 0;
};

GamePlayerCombat.consumeDamage = function consumeDamage(rawDamage, hitType, attackerEnemy) {
  if (respawnInvulnTimer > 0 || !isPlaying()) return;

  const damage = Math.max(1, Math.round(rawDamage));
  const playerTarget = {
    hp: playerHP,
    armor: playerArmor,
    armorMax: playerArmorMax,
    armorRegenDelay: armorRegenDelay
  };
  const result = applyDamage(playerTarget, damage);
  playerHP = playerTarget.hp;
  playerArmor = playerTarget.armor;
  armorRegenDelay = playerTarget.armorRegenDelay;

  if (result.hpLost > 0) {
    GameAudio.play('playerHit');
  }

  if (attackerEnemy && attackerEnemy.group && attackerEnemy.group.position) {
    const playerApi = getPlayerApi();
    if (playerApi && playerApi.getPosition && playerApi.getRotation) {
      const playerPos = playerApi.getPosition();
      const rot = playerApi.getRotation();
      GameUI.showDirectionalDamage(
        attackerEnemy.group.position,
        playerPos,
        rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
        rawDamage
      );
    }
  }

  if (playerHP <= 0) {
    GamePlayerCombat.respawn();
    return;
  }

  GameUI.updateHealth(playerHP, playerMaxHP);
  GameUI.updateArmor(playerArmor, playerArmorMax);
};

GamePlayerCombat.respawn = function respawn() {
  playerHP = playerMaxHP;
  if (!isMultiplayer()) {
    playerArmor = playerArmorMax;
  }
  armorRegenDelay = 0;

  GameUI.updateHealth(playerHP, playerMaxHP);
  GameUI.updateArmor(playerArmor, playerArmorMax);

  if (!isMultiplayer()) {
    const playerApi = getPlayerApi();
    if (playerApi && playerApi.respawnRandom) {
      playerApi.respawnRandom();
    }
    respawnInvulnTimer = 1.0;
  }

  GameUI.updateDamageEffects(5);
};

GamePlayerCombat.applyArmorProfile = function applyArmorProfile(armorMax) {
  playerArmorMax = Math.max(1, armorMax || 100);
  if (playerArmor > playerArmorMax) playerArmor = playerArmorMax;
  if (playerArmor < 0) playerArmor = 0;
  GameUI.updateArmor(playerArmor, playerArmorMax);
};

GamePlayerCombat.tickArmorRegen = function tickArmorRegenWrapper(dt) {
  if (isMultiplayer()) return;
  const regenTarget = { armor: playerArmor, armorMax: playerArmorMax, armorRegenDelay: armorRegenDelay };
  tickArmorRegen(regenTarget, dt);
  playerArmor = regenTarget.armor;
  armorRegenDelay = regenTarget.armorRegenDelay;
};

GamePlayerCombat.syncFromAuthoritativeSelfState = function syncFromAuthoritativeSelfState(selfState) {
  if (!selfState) return;
  playerHP = selfState.hp;
  playerMaxHP = selfState.hpMax;
  playerArmor = selfState.armor;
  playerArmorMax = selfState.armorMax;
  GameUI.updateHealth(playerHP, playerMaxHP);
  GameUI.updateArmor(playerArmor, playerArmorMax);
};

GamePlayerCombat.heal = function heal(amount) {
  const value = Math.max(0, Math.round(Number(amount || 0)));
  if (value <= 0) return 0;
  const previous = playerHP;
  playerHP = Math.min(playerMaxHP, playerHP + value);
  GameUI.updateHealth(playerHP, playerMaxHP);
  return Math.max(0, playerHP - previous);
};

GamePlayerCombat.showIncomingFeedback = function showIncomingFeedback(sourcePos, rawDamage, hitType) {
  GameAudio.play('playerHit');
  const playerApi = getPlayerApi();
  if (sourcePos && playerApi && playerApi.getPosition && playerApi.getRotation) {
    const playerPos = playerApi.getPosition();
    const rot = playerApi.getRotation();
    GameUI.showDirectionalDamage(
      sourcePos,
      playerPos,
      rot && typeof rot.yaw === 'number' ? rot.yaw : 0,
      rawDamage
    );
  }
};

GamePlayerCombat.getHP = function getHP() { return playerHP; };
GamePlayerCombat.getMaxHP = function getMaxHP() { return playerMaxHP; };
GamePlayerCombat.getArmor = function getArmor() { return playerArmor; };
GamePlayerCombat.getArmorMax = function getArmorMax() { return playerArmorMax; };
GamePlayerCombat.setHP = function setHP(hp) { playerHP = hp; };
GamePlayerCombat.setMaxHP = function setMaxHP(hp) { playerMaxHP = hp; };
GamePlayerCombat.setArmor = function setArmor(armor) { playerArmor = armor; };
GamePlayerCombat.setArmorMax = function setArmorMax(armorMax) { playerArmorMax = armorMax; };
GamePlayerCombat.isInvulnerable = function isInvulnerable() { return respawnInvulnTimer > 0; };
GamePlayerCombat.setInvulnTimer = function setInvulnTimer(timeSec) {
  respawnInvulnTimer = Math.max(0, timeSec);
};
GamePlayerCombat.tickInvulnTimer = function tickInvulnTimer(dt) {
  if (respawnInvulnTimer > 0) {
    respawnInvulnTimer -= dt;
    if (respawnInvulnTimer < 0) respawnInvulnTimer = 0;
  }
};
GamePlayerCombat.syncFromNetwork = GamePlayerCombat.syncFromAuthoritativeSelfState;

export const MSG = {
  WELCOME: 'welcome',
  INPUT: 'input',
  FIRE: 'fire',
  EQUIP: 'equip',
  SNAPSHOT: 'snapshot',
  EVENT: 'event'
};

export function makeInputMessage(input) {
  return {
    t: MSG.INPUT,
    input
  };
}

export function makeFireMessage(weaponId, shotId, yaw, pitch) {
  return {
    t: MSG.FIRE,
    weaponId,
    shotId,
    yaw,
    pitch
  };
}

export function makeEquipMessage(weaponId) {
  return {
    t: MSG.EQUIP,
    weaponId
  };
}


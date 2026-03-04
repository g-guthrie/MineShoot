export function getAbilityCooldowns(abilityCfg) {
  return {
    abilityCooldownMs: Math.max(0, Number((abilityCfg && abilityCfg.abilityCooldownMs) || 0)),
    ultimateCooldownMs: Math.max(0, Number((abilityCfg && abilityCfg.ultimateCooldownMs) || 0))
  };
}

export function buildDeadeyeState(deadeyeCfg, picks, now) {
  const maxTargets = Math.max(1, Math.round((deadeyeCfg && deadeyeCfg.maxTargets) || 3));
  const durationMs = Math.max(1, Math.round(Number((deadeyeCfg && deadeyeCfg.duration) || 2.0) * 1000));
  const lockEveryMs = Math.max(1, Math.round(durationMs / maxTargets));
  return {
    queue: picks.map((p) => p.id),
    maxLocks: maxTargets,
    nextLockAt: now + lockEveryMs,
    lockEveryMs,
    lockIndex: 0,
    damage: Math.max(1, Math.round((deadeyeCfg && deadeyeCfg.damage) || 260)),
    endsAt: now + durationMs
  };
}


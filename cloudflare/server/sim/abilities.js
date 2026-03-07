export function getAbilityCooldowns(abilityCfg) {
  return {
    abilityCooldownMs: Math.max(0, Number((abilityCfg && abilityCfg.abilityCooldownMs) || 0)),
    ultimateCooldownMs: Math.max(0, Number((abilityCfg && abilityCfg.ultimateCooldownMs) || 0))
  };
}

export function buildDeadeyeState(deadeyeCfg, picks, now) {
  const pickedCount = Math.max(1, Array.isArray(picks) ? picks.length : 0);
  const durationMs = Math.max(1, Math.round(Number((deadeyeCfg && deadeyeCfg.duration) || 3.0) * 1000));
  const lockEveryMs = Math.max(1, Math.round(durationMs / pickedCount));
  return {
    queue: picks.map((p) => p.id),
    maxLocks: pickedCount,
    nextLockAt: now + lockEveryMs,
    lockEveryMs,
    lockIndex: 0,
    damage: Math.max(1, Math.round((deadeyeCfg && deadeyeCfg.damage) || 260)),
    endsAt: now + durationMs
  };
}

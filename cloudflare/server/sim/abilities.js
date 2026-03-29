function clampInt(value, fallback) {
  const next = Math.round(Number(value));
  return Number.isFinite(next) ? next : fallback;
}

export function buildDeadeyeState(cfg = {}, picks = [], now = 0) {
  const queue = Array.isArray(picks)
    ? picks.map((target) => String(target && target.id || '')).filter(Boolean)
    : [];
  const startedAt = Math.max(0, Number(now || 0));
  const durationMs = Math.max(250, clampInt(Number(cfg.duration || 1.6) * 1000, 1600));
  const maxLocks = Math.max(1, clampInt(cfg.maxTargets, queue.length || 1));
  const stepCount = Math.max(1, queue.length);
  const lockEveryMs = Math.max(120, Math.round(durationMs / stepCount));

  return {
    queue,
    maxLocks,
    lockIndex: 0,
    startedAt,
    nextLockAt: startedAt + lockEveryMs,
    lockEveryMs,
    endsAt: startedAt + durationMs,
    damage: Math.max(1, Number(cfg.damage || 160))
  };
}

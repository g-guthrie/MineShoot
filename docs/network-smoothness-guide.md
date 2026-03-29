# How We Made Movement And Shots Feel Smooth And Instant

This document explains the intended behavior of the networking stack. It is not a proof that the current build still behaves exactly this way. Use the current networking tests and live measurements as the source of truth when this document and the runtime disagree.

This explains the practical choices that made the game feel responsive online.

The short version is:

- We let the local player react immediately instead of waiting for the server.
- We made the client and server use the same movement rules, so replays stay close.
- We only hard-snap when something is clearly wrong.
- We draw other players from a short buffered history instead of jumping to each new packet.
- We judge hits against rewound server history, so a clean shot still counts even if the packet arrives a little later.
- We do not hide bad networking with blur. We keep the view sharp and make the state handling better instead.

## 1. Local camera and shooting respond immediately

The local view does not wait for networking. Mouse input updates aim right away, and the shot trace runs right away from the current camera state.

```js
document.addEventListener('mousemove', function (e) {
    if (!hasInputCapture()) return;
    yaw -= (e.movementX || 0) * sensitivity;
    pitch -= (e.movementY || 0) * sensitivity;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
});
```

```js
var fired = globalThis.__MAYHEM_RUNTIME.GameHitscan.fire(
    camera,
    function (hitboxMesh, hitPoint, distance, hitType, damage, weapon, pelletIndex) {
        ...
    },
    function () {},
    shotToken
);
```

That matters because the player sees the turn and the shot on the same frame they make the input. We did not add a post-process motion blur pass to soften things. The view stays crisp, and the code focuses on removing lag and correction spikes instead.

## 2. We give local hit feedback before the round trip completes

When the local shot hits a networked target, the game shows the feedback immediately instead of waiting for the server to answer.

```js
if (shouldPredictNetHit &&
    globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync &&
    globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.emitPredictedLocalDamageFeedback) {
    globalThis.__MAYHEM_RUNTIME.GameNetFeedbackSync.emitPredictedLocalDamageFeedback({
        weaponId: weapon && weapon.id ? weapon.id : '',
        hitType: hitType,
        shotToken: shotToken,
        pelletIndex: pelletIndex,
        damage: damage,
        worldPos: hitPoint,
        camera: camera,
        killed: false
    });
}
```

Then, when the server confirmation comes back, we match it to the same `shotToken` so we do not play duplicate hit feedback.

```js
var matchedPrediction = consumePredictedHitFeedback(feedback);
var suppressLocalAudio = !!matchedPrediction;
var suppressDamageNumber = !!matchedPrediction;
var shouldShowAuthoritativeConfirm = !feedback.killed && markConfirmedShotToken(feedback.shotToken || '');
```

This is why shots feel instant without becoming messy or double-triggered.

## 3. The client and server use the same movement rules

The local player does not just guess. It steps movement with the same grounded, jump, gravity, collision, sprint, and scoped-movement rules used by the authoritative path.

```js
stepMovement(state, entry.inputState, {
  dtSec: dtSec,
  bounds: bounds,
  collisionBoxes: collisionBoxes,
  getGroundHeightAt: getGroundHeightAt,
  movementLocked: !!movementLocked(entry, state),
  eyeHeight: Number(options.eyeHeight || EYE_HEIGHT),
  playerHeight: Number(options.playerHeight || PLAYER_HEIGHT),
  playerRadius: Number(options.playerRadius || PLAYER_RADIUS),
  epsilon: Number(options.epsilon || 0.001)
});
```

That keeps the local prediction close to the server result. If both sides follow the same rules, there is much less drift to fix later.

## 4. We replay pending inputs first, and we make the snap guard speed-aware

When the server sends the real player position, we do not immediately yank the player to it during normal movement. First we rebuild the motion from the server snapshot and replay the still-pending local inputs on top. The replay uses the same weighted step-building rule as the live authoritative path, so the client is not inventing a different timing model during correction.

```js
if (allowReplayCorrection && reconcile && reconcile.shouldReplayAuthoritativeCorrection && reconcile.shouldReplayAuthoritativeCorrection({
    pendingInputCount: pendingInputCount,
    lastAckedSeq: Number(opts.lastAckedSeq || 0),
    lastReplayAckSeq: lastReplayAckSeq,
    horizontalDistSq: horizontalDistSq,
    replayCorrectionDistance: replayDistance,
    movingIntent: movingIntent,
    canCorrectWhileMoving: canCorrectWhileMoving,
    latestPendingAgeMs: latestPendingAgeMs,
    minPendingAgeMs: movingIntent ? pendingReplayGraceMs : 0,
    allowFreshPendingReplay: allowFreshPendingReplay
})) {
    return replayAuthoritativeMotion(state, pendingInputs, opts);
}
```

The hard-snap guard is also speed-aware. We budget how far the player could reasonably have traveled from the still-pending replay steps, add a small safety margin, and only allow a hard snap once the disagreement is larger than both the base threshold and that believable travel budget.

```js
var believableDistance = believableReplayDistanceWu(reconcile, pendingInputs, opts, airborne);
var hardSnapDistance = Math.max(
    thresholds.hardSnapDistance,
    believableDistance + (hasUnsentInputTail ? thresholds.emergencyReplayDistance : 0)
);

if (
    opts.force ||
    horizontalDistSq >= (hardSnapDistance * hardSnapDistance) ||
    Math.abs(dy) >= hardSnapVerticalDistance
) {
    return applyAuthoritativeMotion(state);
}
```

That is the main reason sprinting and other fast movement no longer turn into an automatic online "snap back" unless something genuinely broke.

## 5. Small leftover errors are blended only when it is safe

If the player is idle, has no pending replay work, and the mismatch is small, we gently settle toward the server state instead of forcing a correction during active movement.

```js
if (pendingInputCount > 0 || hasUnsentInputTail || movingIntent || horizontalDistSq < (idleBlendDistance * idleBlendDistance)) {
    return false;
}

var blend = Math.min(1, dt * Math.max(0.1, idleBlendRate));
playerX += dx * blend;
playerZ += dz * blend;
posY += dy * blend;
```

This keeps cleanup quiet. We do not fight the player while they are still moving, still replaying, or still carrying an unsent local tail.

## 6. Other players are rendered from buffered history, not from raw packet arrival

Remote players are where network snap usually becomes visible. We avoid that by storing a history of snapshots and rendering slightly behind real time, between two known good samples.

```js
var renderServerTime = nowMs - serverTimeOffsetMs - interpolationDelayMs;
...
var t = clamp((renderServerTime - olderTime) / span, 0, 1);
return {
    x: Number(older.x || 0) + ((Number(newer.x || 0) - Number(older.x || 0)) * t),
    footY: Number(older.footY || 0) + ((Number(newer.footY || 0) - Number(older.footY || 0)) * t),
    z: Number(older.z || 0) + ((Number(newer.z || 0) - Number(older.z || 0)) * t),
    yaw: Number(older.yaw || 0) + (normalizeAngle(Number(newer.yaw || 0) - Number(older.yaw || 0)) * t),
    pitch: Number(older.pitch || 0) + ((Number(newer.pitch || 0) - Number(older.pitch || 0)) * t)
};
```

We also keep that delay adaptive, based on packet spacing and jitter, instead of using a fixed guess for every connection.

```js
var interpolationDelayMs = explicitDelayMs > 0
    ? Math.max(minDelayMs, explicitDelayMs)
    : clamp(
        (intervalMs * Number(interpolationTuning.intervalDelayScale || 2.6)) +
        (jitterMs * Number(interpolationTuning.jitterDelayScale || 2.1)),
        minDelayMs,
        maxDelayMs
    );
```

So remote movement looks steady instead of twitchy.

## 7. We do not smear missing data across long gaps

If packets stop arriving for too long, we stop pretending we know the exact path. We freeze or use only a very small extrapolation window.

```js
if (history.length < 2 || latestGapMs > freezeGapMs) {
    return {
        x: Number(last.x || 0),
        footY: Number(last.footY || 0),
        z: Number(last.z || 0),
        yaw: Number(last.yaw || 0),
        pitch: Number(last.pitch || 0)
    };
}
```

```js
var extrapolationMs = clamp(
    renderServerTime - Number(last.serverTime || 0),
    0,
    Math.min(maxExtrapolationMs, intervalMs + jitterMs)
);
```

That is a big reason remote players do not turn into blurry, rubbery ghosts. We would rather hold briefly than invent too much motion.

## 8. The server rewinds history when checking hits

The shot should be judged against where the target was when the player fired, not only where the target is when the packet finally arrives. So the server records recent entity history and rewinds to the shot time during hit checks.

```js
export function resolveShotServerTime(nowMs, rawShotServerTime) {
  const stamp = Number(rawShotServerTime);
  if (!Number.isFinite(stamp)) return Number(nowMs || 0);
  return clamp(stamp, Number(nowMs || 0) - MAX_REWIND_MS, Number(nowMs || 0) + FUTURE_TOLERANCE_MS);
}
```

```js
const hit = findLagCompensatedHit({
  shooter: player,
  entities: Array.from(runtime.players.values()),
  shotServerTime,
  maxDistance: effectiveMaxRange,
  aimYaw,
  aimPitch,
  colliders: runtime.worldColliders
});
```

This is what makes a fast shot still feel fair online. The local player gets immediate feedback, and the server still validates it against rewound history instead of trusting the raw arrival delay.

## 9. Shot spread stays consistent on both sides

We also keep shot spread tied to a shared `shotToken`, so the client and server are not rolling different random outcomes for the same trigger pull.

```js
const angle = seededUnit(shotToken, pelletIndex * 2) * Math.PI * 2;
const radius = Math.sqrt(seededUnit(shotToken, pelletIndex * 2 + 1)) * maxRadius;
```

That removes a whole class of "looked on target here, missed on the server" disagreements.

## Practical summary

If you want the same result in another game, the recipe is simple:

1. Make local input and local camera immediate.
2. Predict locally using the same movement rules the server uses.
3. When authority arrives, replay pending inputs first and snap only for big mistakes.
4. Render remote players from a short history buffer, not directly from live packet arrival.
5. Cap extrapolation hard so remote players do not smear.
6. Rewind server history for hit checks.
7. Use per-shot IDs so local feedback and server confirmation can be matched cleanly.

That combination is what removed the feeling of delayed shots, player position snap, and fake blur from online movement.

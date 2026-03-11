(function () {
    'use strict';

    function cloneVec3(value) {
        if (!value || typeof value !== 'object') return null;
        var x = Number(value.x);
        var y = Number(value.y);
        var z = Number(value.z);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null;
        return { x: x, y: y, z: z };
    }

    function readAbilityFx(entity) {
        return (entity && entity.abilityFx && typeof entity.abilityFx === 'object') ? entity.abilityFx : null;
    }

    function timedState(endsAt) {
        var stamp = Number(endsAt || 0);
        return stamp > 0 ? { endsAt: stamp } : null;
    }

    function cloneHookVisual(state) {
        if (!state || typeof state !== 'object') return null;
        return {
            phase: state.phase || 'travel',
            targetId: state.targetId || '',
            headPos: cloneVec3(state.headPos || null),
            attachPos: cloneVec3(state.attachPos || null),
            endsAt: Number(state.endsAt || 0)
        };
    }

    function getLiftHeight(state) {
        if (!state || typeof state !== 'object') return 0;
        if (state.liftHeight != null) return Number(state.liftHeight || 0);
        if (state.lift != null) return Number(state.lift || 0);
        if (state.chokeLift != null) return Number(state.chokeLift || 0);
        return 0;
    }

    function chokeLiftAt(state, now) {
        if (!state) return 0;
        var stamp = Number(now || Date.now());
        var startedAt = Number(state.startedAt || 0);
        var endsAt = Number(state.endsAt || 0);
        if (!(endsAt > stamp)) return 0;
        var maxLift = getLiftHeight(state);
        if (!(endsAt > startedAt)) return maxLift;
        var progress = Math.max(0, Math.min(1, (stamp - startedAt) / (endsAt - startedAt)));
        if (progress <= 0) return 0;
        if (progress >= 1) return 0;
        if (progress < 0.24) return maxLift * Math.sin((progress / 0.24) * (Math.PI * 0.5));
        if (progress > 0.76) return maxLift * Math.cos(((progress - 0.76) / 0.24) * (Math.PI * 0.5));
        return maxLift;
    }

    function emptyChokeVictimState() {
        return { lift: 0, liftHeight: 0, startedAt: 0, endsAt: 0 };
    }

    function toChokeVictimVisualState(state, now) {
        if (!state) return emptyChokeVictimState();
        var stamp = Number(now || Date.now());
        var endsAt = Number(state.endsAt || 0);
        if (!(endsAt > stamp)) return emptyChokeVictimState();
        return {
            lift: chokeLiftAt(state, stamp),
            liftHeight: getLiftHeight(state),
            startedAt: Number(state.startedAt || 0),
            endsAt: endsAt
        };
    }

    function buildSnapshotAbilityState(entity) {
        var abilityFx = readAbilityFx(entity);
        return {
            abilityFx: abilityFx,
            chokeVictimState: abilityFx ? (abilityFx.chokeVictim || null) : null,
            hookedStartedAt: abilityFx ? Number(abilityFx.hookedStartedAt || 0) : 0,
            hookedUntil: abilityFx ? Number(abilityFx.hookedUntil || 0) : 0,
            hookState: abilityFx ? cloneHookVisual(abilityFx.hookVisual || null) : null,
            chokeState: abilityFx ? timedState(abilityFx.chokeCasterUntil) : null,
            healState: abilityFx ? timedState(abilityFx.healUntil) : null
        };
    }

    function resolveHookVisualEnd(state, resolveTargetPosition) {
        if (!state || typeof state !== 'object') return null;
        if (state.phase === 'latched' && state.attachPos) {
            return cloneVec3(state.attachPos);
        }
        if (state.phase === 'latched' && state.targetId && typeof resolveTargetPosition === 'function') {
            return cloneVec3(resolveTargetPosition(state.targetId));
        }
        return cloneVec3(state.headPos || null);
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameAbilityFx = {
        buildSnapshotAbilityState: buildSnapshotAbilityState,
        chokeLiftAt: chokeLiftAt,
        cloneHookVisual: cloneHookVisual,
        cloneVec3: cloneVec3,
        emptyChokeVictimState: emptyChokeVictimState,
        readAbilityFx: readAbilityFx,
        resolveHookVisualEnd: resolveHookVisualEnd,
        timedState: timedState,
        toChokeVictimVisualState: toChokeVictimVisualState
    };
})();

(function (global) {
    'use strict';

    if (global.__GAME_SCHEMA__) return;

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        var keys = Object.keys(value);
        for (var i = 0; i < keys.length; i++) {
            deepFreeze(value[keys[i]]);
        }
        return value;
    }

    function isObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && isFinite(value);
    }

    function isBoolean(value) {
        return typeof value === 'boolean';
    }

    function isString(value) {
        return typeof value === 'string';
    }

    function validateCameraMode(value, fieldName) {
        var label = fieldName || 'cameraMode';
        if (!isString(value)) return [label + ' must be a string'];
        if (value !== 'first' && value !== 'third') {
            return [label + ' must be "first" or "third"'];
        }
        return [];
    }

    function okResult(value) {
        return { ok: true, errors: [], value: value };
    }

    function failResult(errors) {
        return { ok: false, errors: errors.slice() };
    }

    function validateActions(actions) {
        if (actions === undefined) return [];
        if (!Array.isArray(actions)) return ['input.actions must be an array when provided'];
        var errors = [];
        for (var i = 0; i < actions.length; i++) {
            var action = actions[i];
            if (!isString(action) || !action) {
                errors.push('input.actions[' + i + '] must be a non-empty string');
            }
        }
        return errors;
    }

    function validateClientInput(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('input must be an object');
        if (!errors.length && msg.t !== 'input') errors.push('input.t must be "input"');

        if (!errors.length && !isFiniteNumber(msg.moveX)) errors.push('input.moveX must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.moveZ)) errors.push('input.moveZ must be a finite number');
        if (!errors.length && !isBoolean(msg.jumpHeld)) errors.push('input.jumpHeld must be a boolean');
        if (!errors.length && !isBoolean(msg.sprint)) errors.push('input.sprint must be a boolean');
        if (!errors.length && !isFiniteNumber(msg.yaw)) errors.push('input.yaw must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.pitch)) errors.push('input.pitch must be a finite number');

        if (!errors.length && msg.seq !== undefined && !isFiniteNumber(msg.seq)) {
            errors.push('input.seq must be a finite number');
        }
        if (!errors.length && msg.cameraMode !== undefined) {
            errors = errors.concat(validateCameraMode(msg.cameraMode, 'input.cameraMode'));
        }
        if (!errors.length) {
            errors = errors.concat(validateActions(msg.actions));
        }

        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateEntityState(entity, index) {
        var errors = [];
        var prefix = 'entities[' + index + ']';

        if (!isObject(entity)) {
            errors.push(prefix + ' must be an object');
            return errors;
        }

        if (!isString(entity.id) || !entity.id) errors.push(prefix + '.id must be a non-empty string');
        if (!isString(entity.kind) || (entity.kind !== 'player' && entity.kind !== 'bot')) {
            errors.push(prefix + '.kind must be "player" or "bot"');
        }
        if (!isString(entity.classId) || !entity.classId) errors.push(prefix + '.classId must be a non-empty string');
        if (!isFiniteNumber(entity.x)) errors.push(prefix + '.x must be a finite number');
        if (!isFiniteNumber(entity.feetY)) errors.push(prefix + '.feetY must be a finite number');
        if (!isFiniteNumber(entity.z)) errors.push(prefix + '.z must be a finite number');
        if (!isFiniteNumber(entity.yaw)) errors.push(prefix + '.yaw must be a finite number');
        if (!isFiniteNumber(entity.pitch)) errors.push(prefix + '.pitch must be a finite number');
        if (entity.velY !== undefined && !isFiniteNumber(entity.velY)) errors.push(prefix + '.velY must be a finite number');
        if (entity.grounded !== undefined && !isBoolean(entity.grounded)) errors.push(prefix + '.grounded must be a boolean');
        if (!isFiniteNumber(entity.hp)) errors.push(prefix + '.hp must be a finite number');
        if (!isFiniteNumber(entity.hpMax)) errors.push(prefix + '.hpMax must be a finite number');
        if (!isFiniteNumber(entity.armor)) errors.push(prefix + '.armor must be a finite number');
        if (!isFiniteNumber(entity.armorMax)) errors.push(prefix + '.armorMax must be a finite number');
        if (!isBoolean(entity.alive)) errors.push(prefix + '.alive must be a boolean');

        if (entity.weaponId !== undefined && !isString(entity.weaponId)) {
            errors.push(prefix + '.weaponId must be a string');
        }
        if (entity.moveSpeedNorm !== undefined && !isFiniteNumber(entity.moveSpeedNorm)) {
            errors.push(prefix + '.moveSpeedNorm must be a finite number');
        }
        if (entity.sprinting !== undefined && !isBoolean(entity.sprinting)) {
            errors.push(prefix + '.sprinting must be a boolean');
        }
        if (entity.animState !== undefined && !isString(entity.animState)) {
            errors.push(prefix + '.animState must be a string');
        }
        if (entity.animPhase !== undefined && !isFiniteNumber(entity.animPhase)) {
            errors.push(prefix + '.animPhase must be a finite number');
        }
        if (entity.gripMode !== undefined && !isString(entity.gripMode)) {
            errors.push(prefix + '.gripMode must be a string');
        }
        if (entity.aimPitch !== undefined && !isFiniteNumber(entity.aimPitch)) {
            errors.push(prefix + '.aimPitch must be a finite number');
        }

        return errors;
    }

    function validateServerEntitySnapshot(msg) {
        var errors = [];
        var validEntities = [];

        if (!isObject(msg)) errors.push('entity_snapshot must be an object');
        if (!errors.length && msg.t !== 'entity_snapshot') errors.push('entity_snapshot.t must be "entity_snapshot"');
        if (!errors.length && !isFiniteNumber(msg.serverTime)) errors.push('entity_snapshot.serverTime must be a finite number');
        if (!errors.length && !Array.isArray(msg.entities)) errors.push('entity_snapshot.entities must be an array');

        if (!errors.length) {
            for (var i = 0; i < msg.entities.length; i++) {
                var entity = msg.entities[i];
                var entityErrors = validateEntityState(entity, i);
                if (entityErrors.length > 0) {
                    errors = errors.concat(entityErrors);
                } else {
                    validEntities.push(entity);
                }
            }
        }

        if (errors.length) {
            return {
                ok: false,
                errors: errors,
                droppedCount: (msg && msg.entities && msg.entities.length) ? msg.entities.length - validEntities.length : 0,
                value: null
            };
        }

        return {
            ok: true,
            errors: [],
            droppedCount: 0,
            value: {
                t: 'entity_snapshot',
                serverTime: msg.serverTime,
                entities: validEntities
            }
        };
    }

    function validateServerReconcile(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('server_reconcile must be an object');
        if (!errors.length && msg.t !== 'server_reconcile') errors.push('server_reconcile.t must be "server_reconcile"');
        if (!errors.length && !isFiniteNumber(msg.x)) errors.push('server_reconcile.x must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.feetY)) errors.push('server_reconcile.feetY must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.z)) errors.push('server_reconcile.z must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.velY)) errors.push('server_reconcile.velY must be a finite number');
        if (!errors.length && !isBoolean(msg.grounded)) errors.push('server_reconcile.grounded must be a boolean');
        if (!errors.length && !isFiniteNumber(msg.yaw)) errors.push('server_reconcile.yaw must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.pitch)) errors.push('server_reconcile.pitch must be a finite number');
        if (!errors.length && msg.seq !== undefined && !isFiniteNumber(msg.seq)) errors.push('server_reconcile.seq must be a finite number');
        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateChunkSnapshot(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('chunk_snapshot must be an object');
        if (!errors.length && msg.t !== 'chunk_snapshot') errors.push('chunk_snapshot.t must be "chunk_snapshot"');
        if (!errors.length && !isObject(msg.chunk)) errors.push('chunk_snapshot.chunk must be an object');
        if (!errors.length) {
            var chunk = msg.chunk;
            if (!isString(chunk.key) || !chunk.key) errors.push('chunk_snapshot.chunk.key must be a non-empty string');
            if (!isFiniteNumber(chunk.version)) errors.push('chunk_snapshot.chunk.version must be a finite number');
            if (!Array.isArray(chunk.solids)) errors.push('chunk_snapshot.chunk.solids must be an array');
        }
        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateChunkDelta(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('chunk_delta must be an object');
        if (!errors.length && msg.t !== 'chunk_delta') errors.push('chunk_delta.t must be "chunk_delta"');
        if (!errors.length && !isString(msg.key)) errors.push('chunk_delta.key must be a string');
        if (!errors.length && !isFiniteNumber(msg.version)) errors.push('chunk_delta.version must be a finite number');
        if (!errors.length && msg.op !== undefined && !isString(msg.op)) errors.push('chunk_delta.op must be a string when provided');
        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateThrowableSnapshot(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('throwable_snapshot must be an object');
        if (!errors.length && msg.t !== 'throwable_snapshot') errors.push('throwable_snapshot.t must be "throwable_snapshot"');
        if (!errors.length && !isFiniteNumber(msg.serverTime)) errors.push('throwable_snapshot.serverTime must be a finite number');
        if (!errors.length && !Array.isArray(msg.throwables)) errors.push('throwable_snapshot.throwables must be an array');
        if (!errors.length && !Array.isArray(msg.zones)) errors.push('throwable_snapshot.zones must be an array');

        if (!errors.length) {
            for (var i = 0; i < msg.throwables.length; i++) {
                var t = msg.throwables[i];
                var tp = 'throwable_snapshot.throwables[' + i + ']';
                if (!isObject(t)) {
                    errors.push(tp + ' must be an object');
                    continue;
                }
                if (!isString(t.id) || !t.id) errors.push(tp + '.id must be a non-empty string');
                if (!isString(t.type) || !t.type) errors.push(tp + '.type must be a non-empty string');
                if (!isFiniteNumber(t.x)) errors.push(tp + '.x must be a finite number');
                if (!isFiniteNumber(t.y)) errors.push(tp + '.y must be a finite number');
                if (!isFiniteNumber(t.z)) errors.push(tp + '.z must be a finite number');
                if (!isFiniteNumber(t.vx)) errors.push(tp + '.vx must be a finite number');
                if (!isFiniteNumber(t.vy)) errors.push(tp + '.vy must be a finite number');
                if (!isFiniteNumber(t.vz)) errors.push(tp + '.vz must be a finite number');
                if (t.fuse !== undefined && !isFiniteNumber(t.fuse)) errors.push(tp + '.fuse must be a finite number');
                if (t.ownerId !== undefined && !isString(t.ownerId)) errors.push(tp + '.ownerId must be a string');
                if (t.state !== undefined && !isString(t.state)) errors.push(tp + '.state must be a string');
            }
            for (var j = 0; j < msg.zones.length; j++) {
                var z = msg.zones[j];
                var zp = 'throwable_snapshot.zones[' + j + ']';
                if (!isObject(z)) {
                    errors.push(zp + ' must be an object');
                    continue;
                }
                if (!isString(z.id) || !z.id) errors.push(zp + '.id must be a non-empty string');
                if (!isFiniteNumber(z.x)) errors.push(zp + '.x must be a finite number');
                if (!isFiniteNumber(z.z)) errors.push(zp + '.z must be a finite number');
                if (!isFiniteNumber(z.radius)) errors.push(zp + '.radius must be a finite number');
                if (!isFiniteNumber(z.lifeLeft)) errors.push(zp + '.lifeLeft must be a finite number');
                if (z.type !== undefined && !isString(z.type)) errors.push(zp + '.type must be a string');
            }
        }

        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateThrowableEvent(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('throwable_event must be an object');
        if (!errors.length && msg.t !== 'throwable_event') errors.push('throwable_event.t must be "throwable_event"');
        if (!errors.length && !isString(msg.eventType)) errors.push('throwable_event.eventType must be a string');
        if (!errors.length && !isString(msg.id)) errors.push('throwable_event.id must be a string');
        if (!errors.length && msg.type !== undefined && !isString(msg.type)) errors.push('throwable_event.type must be a string');
        if (!errors.length && msg.x !== undefined && !isFiniteNumber(msg.x)) errors.push('throwable_event.x must be a finite number');
        if (!errors.length && msg.y !== undefined && !isFiniteNumber(msg.y)) errors.push('throwable_event.y must be a finite number');
        if (!errors.length && msg.z !== undefined && !isFiniteNumber(msg.z)) errors.push('throwable_event.z must be a finite number');
        if (!errors.length && msg.radius !== undefined && !isFiniteNumber(msg.radius)) errors.push('throwable_event.radius must be a finite number');
        if (!errors.length && msg.ttlMs !== undefined && !isFiniteNumber(msg.ttlMs)) errors.push('throwable_event.ttlMs must be a finite number');
        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateFireIntent(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('fire_intent must be an object');
        if (!errors.length && msg.t !== 'fire_intent') errors.push('fire_intent.t must be "fire_intent"');
        if (!errors.length && !isString(msg.weaponId)) errors.push('fire_intent.weaponId must be a string');
        if (!errors.length && msg.seq !== undefined && !isFiniteNumber(msg.seq)) errors.push('fire_intent.seq must be a finite number');
        if (!errors.length && msg.fireMode !== undefined && !isString(msg.fireMode)) {
            errors.push('fire_intent.fireMode must be a string when provided');
        }
        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateThrowIntent(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('throw_intent must be an object');
        if (!errors.length && msg.t !== 'throw_intent') errors.push('throw_intent.t must be "throw_intent"');
        if (!errors.length && !isString(msg.throwableId)) errors.push('throw_intent.throwableId must be a string');
        if (!errors.length && msg.seq !== undefined && !isFiniteNumber(msg.seq)) errors.push('throw_intent.seq must be a finite number');
        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateChunkSubscribe(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('chunk_subscribe must be an object');
        if (!errors.length && msg.t !== 'chunk_subscribe') errors.push('chunk_subscribe.t must be "chunk_subscribe"');
        if (!errors.length && !isFiniteNumber(msg.centerChunkX)) errors.push('chunk_subscribe.centerChunkX must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.centerChunkZ)) errors.push('chunk_subscribe.centerChunkZ must be a finite number');
        if (errors.length) return failResult(errors);
        return okResult(msg);
    }

    function validateLoadout(dto, allowedIds) {
        var errors = [];
        if (!isObject(dto)) errors.push('loadout must be an object');
        if (!errors.length && !Array.isArray(dto.slots)) errors.push('loadout.slots must be an array');
        if (errors.length) return failResult(errors);

        var allowedMap = null;
        if (Array.isArray(allowedIds)) {
            allowedMap = {};
            for (var a = 0; a < allowedIds.length; a++) {
                allowedMap[String(allowedIds[a])] = true;
            }
        }

        var seen = {};
        var outSlots = [];
        for (var i = 0; i < dto.slots.length; i++) {
            var id = String(dto.slots[i] || '');
            if (!id) continue;
            if (seen[id]) continue;
            if (allowedMap && !allowedMap[id]) {
                errors.push('loadout.slots[' + i + '] "' + id + '" is not in allowed ids');
                continue;
            }
            seen[id] = true;
            outSlots.push(id);
        }

        if (outSlots.length === 0) errors.push('loadout must contain at least one slot id');
        if (errors.length) return failResult(errors);
        return okResult({ slots: outSlots });
    }

    function validateWsClientMessage(msg) {
        if (!isObject(msg)) return failResult(['ws message must be an object']);
        if (!isString(msg.t) || !msg.t) return failResult(['ws message must include string "t"']);

        if (msg.t === 'join_room' || msg.t === 'ping') return okResult(msg);
        if (msg.t === 'input') return validateClientInput(msg);
        if (msg.t === 'fire_intent') return validateFireIntent(msg);
        if (msg.t === 'throw_intent') return validateThrowIntent(msg);
        if (msg.t === 'chunk_subscribe') return validateChunkSubscribe(msg);

        if (msg.t === 'equip_weapon') {
            if (!isString(msg.weaponId) || !msg.weaponId) {
                return failResult(['equip_weapon.weaponId must be a non-empty string']);
            }
            return okResult(msg);
        }

        if (msg.t === 'class_queue') {
            if (!isString(msg.classId) || !msg.classId) {
                return failResult(['class_queue.classId must be a non-empty string']);
            }
            return okResult(msg);
        }

        return failResult(['unknown ws message type: ' + msg.t]);
    }

    var schema = {
        validateCameraMode: validateCameraMode,
        validateClientInput: validateClientInput,
        validateServerSnapshot: validateServerEntitySnapshot,
        validateServerEntitySnapshot: validateServerEntitySnapshot,
        validateServerReconcile: validateServerReconcile,
        validateChunkSnapshot: validateChunkSnapshot,
        validateChunkDelta: validateChunkDelta,
        validateThrowableSnapshot: validateThrowableSnapshot,
        validateThrowableEvent: validateThrowableEvent,
        validateFireIntent: validateFireIntent,
        validateThrowIntent: validateThrowIntent,
        validateChunkSubscribe: validateChunkSubscribe,
        validateLoadout: validateLoadout,
        validateWsClientMessage: validateWsClientMessage
    };

    global.__GAME_SCHEMA__ = deepFreeze(schema);
})(typeof globalThis !== 'undefined' ? globalThis : this);

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

    function okResult(value) {
        return { ok: true, errors: [], value: value };
    }

    function failResult(errors) {
        return { ok: false, errors: errors.slice() };
    }

    function validateClientInput(msg) {
        var errors = [];
        if (!isObject(msg)) errors.push('input must be an object');
        if (!errors.length && msg.t !== 'input') errors.push('input.t must be "input"');

        if (!errors.length && !isFiniteNumber(msg.x)) errors.push('input.x must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.z)) errors.push('input.z must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.feetY)) errors.push('input.feetY must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.yaw)) errors.push('input.yaw must be a finite number');
        if (!errors.length && !isFiniteNumber(msg.pitch)) errors.push('input.pitch must be a finite number');

        if (!errors.length && msg.seq !== undefined && !isFiniteNumber(msg.seq)) {
            errors.push('input.seq must be a finite number');
        }
        if (!errors.length && msg.weaponId !== undefined && !isString(msg.weaponId)) {
            errors.push('input.weaponId must be a string');
        }
        if (!errors.length && msg.moveSpeedNorm !== undefined && !isFiniteNumber(msg.moveSpeedNorm)) {
            errors.push('input.moveSpeedNorm must be a finite number');
        }
        if (!errors.length && msg.sprinting !== undefined && !isBoolean(msg.sprinting)) {
            errors.push('input.sprinting must be a boolean');
        }
        if (!errors.length && msg.sprint !== undefined && !isBoolean(msg.sprint)) {
            errors.push('input.sprint must be a boolean');
        }
        if (!errors.length && msg.jump !== undefined && !isBoolean(msg.jump)) {
            errors.push('input.jump must be a boolean');
        }
        if (!errors.length && msg.animState !== undefined && !isString(msg.animState)) {
            errors.push('input.animState must be a string');
        }
        if (!errors.length && msg.animPhase !== undefined && !isFiniteNumber(msg.animPhase)) {
            errors.push('input.animPhase must be a finite number');
        }
        if (!errors.length && msg.gripMode !== undefined && !isString(msg.gripMode)) {
            errors.push('input.gripMode must be a string');
        }
        if (!errors.length && msg.aimPitch !== undefined && !isFiniteNumber(msg.aimPitch)) {
            errors.push('input.aimPitch must be a finite number');
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

    function validateServerSnapshot(msg) {
        var errors = [];
        var validEntities = [];

        if (!isObject(msg)) errors.push('snapshot must be an object');
        if (!errors.length && msg.t !== 'snapshot') errors.push('snapshot.t must be "snapshot"');
        if (!errors.length && !isFiniteNumber(msg.serverTime)) errors.push('snapshot.serverTime must be a finite number');
        if (!errors.length && !Array.isArray(msg.entities)) errors.push('snapshot.entities must be an array');

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
                t: 'snapshot',
                serverTime: msg.serverTime,
                entities: validEntities
            }
        };
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

        if (msg.t === 'equip_weapon') {
            if (!isString(msg.weaponId) || !msg.weaponId) {
                return failResult(['equip_weapon.weaponId must be a non-empty string']);
            }
            return okResult(msg);
        }

        if (msg.t === 'fire') {
            var fireErrors = [];
            if (!isString(msg.targetId) || !msg.targetId) fireErrors.push('fire.targetId must be a non-empty string');
            if (!isString(msg.weaponId) || !msg.weaponId) fireErrors.push('fire.weaponId must be a non-empty string');
            if (msg.hitType !== 'body' && msg.hitType !== 'head') fireErrors.push('fire.hitType must be "body" or "head"');
            if (fireErrors.length) return failResult(fireErrors);
            return okResult(msg);
        }

        if (msg.t === 'plasma_tick') {
            if (!isString(msg.targetId) || !msg.targetId) {
                return failResult(['plasma_tick.targetId must be a non-empty string']);
            }
            return okResult(msg);
        }

        if (msg.t === 'throw') {
            if (!isString(msg.throwableId) || !msg.throwableId) {
                return failResult(['throw.throwableId must be a non-empty string']);
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
        validateClientInput: validateClientInput,
        validateServerSnapshot: validateServerSnapshot,
        validateLoadout: validateLoadout,
        validateWsClientMessage: validateWsClientMessage
    };

    global.__GAME_SCHEMA__ = deepFreeze(schema);
})(typeof globalThis !== 'undefined' ? globalThis : this);

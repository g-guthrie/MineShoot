import {
    DurableObject
} from "cloudflare:workers";
import "../shared/game-primitives.js";
import "../shared/coord-system.js";
import "../shared/world-layout.js";
import "../shared/game-schema.js";
import "../shared/aim-parity.js";
import "../shared/beam-lock.js";
const PRIM = globalThis.__GAME_PRIMITIVES__ || {},
    COORD_SYSTEM = globalThis.__GAME_COORD_SYSTEM__ || {},
    WORLD_LAYOUT = globalThis.__GAME_WORLD_LAYOUT__ || {},
    SCHEMA = globalThis.__GAME_SCHEMA__ || {},
    AIM_PARITY = globalThis.__GAME_AIM_PARITY__ || {},
    BEAM_LOCK = globalThis.__GAME_BEAM_LOCK__ || {},
    COMBAT_PRIM = PRIM.combat || {},
    WORLD_PRIM = PRIM.world || {},
    NETWORK_PRIM = PRIM.network || {},
    ENTITY_PRIM = PRIM.entity || {},
    COORDS_PRIM = PRIM.coords || {},
    CLASS_PRESETS = COMBAT_PRIM.class_presets || {},
    WEAPON_STATS = (() => {
        const src = COMBAT_PRIM.weapon_stats || {},
            keys = Object.keys(src),
            out = {};
        for (let i = 0; i < keys.length; i++) {
            const id = keys[i],
                s = src[id];
            out[id] = {
                cooldownMs: Number(s.cooldown_ms || 0),
                bodyDamage: Number(s.body_damage || 0),
                headDamage: Number(s.head_damage || 0),
                maxRange: Number(s.max_range || 0)
            }
        }
        return out
    })(),
    LOCK_PROFILES_PRIM = COMBAT_PRIM.lock_profiles || {},
    CONTINUOUS_WEAPONS_PRIM = COMBAT_PRIM.continuous_weapons || {},
    createBeamLockState = BEAM_LOCK && BEAM_LOCK.createBeamLockState ? BEAM_LOCK.createBeamLockState : () => ({
        lockedTargetId: "",
        lockReason: "searching",
        overlapArea: 0,
        candidateCount: 0,
        overlapCount: 0
    }),
    resetBeamLockState = BEAM_LOCK && BEAM_LOCK.resetBeamLockState ? BEAM_LOCK.resetBeamLockState : (state, reason) => {
        const next = state && "object" == typeof state ? state : createBeamLockState();
        return next.lockedTargetId = "", next.lockReason = reason || "searching", next.overlapArea = 0, next.candidateCount = 0, next.overlapCount = 0, next
    },
    stepBeamLock = BEAM_LOCK && BEAM_LOCK.stepBeamLock ? BEAM_LOCK.stepBeamLock : (state, input) => {
        const next = resetBeamLockState(state, input && input.triggerHeld ? "searching" : "trigger_released");
        return {
            state: next,
            target: null,
            targetId: "",
            reason: next.lockReason,
            locked: !1
        }
    },
    MAX_HP = Number(COMBAT_PRIM.max_hp || 500),
    ARMOR_REGEN_DELAY_MS = 1e3 * Number(COMBAT_PRIM.armor_regen_delay_sec || 6),
    ARMOR_REGEN_PER_SEC = Number(COMBAT_PRIM.armor_regen_per_sec || 12),
    PLASMA_MAX_SUSTAIN_MS = Number(COMBAT_PRIM.plasma && COMBAT_PRIM.plasma.max_sustain_ms || 2500),
    PLASMA_OVERHEAT_MS = Number(COMBAT_PRIM.plasma && COMBAT_PRIM.plasma.overheat_ms || 1600),
    REMOTE_BEAM_HOLD_MS = Number(COMBAT_PRIM.plasma && COMBAT_PRIM.plasma.beam_hold_ms || 180),
    PLASMA_TICK_MS = Math.max(1, Math.round(1e3 / Math.max(1, Number(COMBAT_PRIM.plasma && COMBAT_PRIM.plasma.tick_hz || 10)))),
    NETWORK_TICK_RATE_HZ = Math.max(1, Math.round(Number(NETWORK_PRIM.tick_rate_hz || 30))),
    NETWORK_TICK_INTERVAL_MS = Math.max(1, Math.round(1e3 / NETWORK_TICK_RATE_HZ)),
    PITCH_LIMIT_RAD = Number(COORD_SYSTEM && COORD_SYSTEM.DEFAULT_PITCH_LIMIT_RAD || 89 * Math.PI / 180),
    VALID_ANIM_STATES = new Set(["idle", "walk", "run", "sprint", "airborne", "strafe"]),
    VALID_GRIP_MODES = new Set(["one_hand", "two_hand"]),
    HITBOX_PRIM = PRIM.hitboxes || {},
    BODY_HITBOX_SIZE = HITBOX_PRIM.body && HITBOX_PRIM.body.size || [2.7, 2, 2.7],
    HEAD_HITBOX_SIZE = HITBOX_PRIM.head && HITBOX_PRIM.head.size || [1.55, .95, 1.55],
    BODY_HITBOX_OFFSET = Number(COORDS_PRIM.body_hitbox_offset_y || 1),
    HEAD_HITBOX_OFFSET = Number(COORDS_PRIM.head_hitbox_offset_y || 2.475),
    AIM_VIEWPORT = AIM_PARITY && AIM_PARITY.getCanonicalViewport ? AIM_PARITY.getCanonicalViewport() : {
        width: 1920,
        height: 1080
    },
    COLLISION_STEP = Number(ENTITY_PRIM.collision_step_size || .6),
    THROWABLE_DEFS = {
        frag: {
            cooldownMs: 2400,
            fuseSec: 2.4,
            speed: 18,
            gravity: 18,
            radius: 5.4,
            damage: 160
        },
        seeker: {
            cooldownMs: 4200,
            fuseSec: 2.8,
            speed: 14,
            gravity: 14,
            radius: 4.8,
            damage: 130,
            seekStrength: 9.5
        },
        molotov: {
            cooldownMs: 4600,
            fuseSec: 1.2,
            speed: 16,
            gravity: 18,
            radius: 4.3,
            damage: 90,
            zoneDuration: 5.5,
            zoneTickRate: .25,
            zoneTickDamage: 16
        },
        knife: {
            cooldownMs: 1600,
            fuseSec: 1.5,
            speed: 29,
            gravity: 3,
            radius: .8,
            damageBody: 100,
            damageHead: 9999
        }
    };

function nowMs() {
    return Date.now()
}

function randomId(prefix) {
    return prefix + "_" + crypto.randomUUID().replace(/-/g, "")
}

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...extraHeaders
        }
    })
}

function constantTimeEqualString(a, b) {
    a = String(a || "");
    b = String(b || "");
    let mismatch = a.length ^ b.length;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return 0 === mismatch
}

function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary)
}

function base64ToBytes(base64Text) {
    const binary = atob(String(base64Text || ""));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out
}

function createPinSaltBase64() {
    const salt = new Uint8Array(16);
    return crypto.getRandomValues(salt), bytesToBase64(salt)
}

async function hashPinWithSalt(pin, saltBase64) {
    const pinText = String(pin || ""),
        salt = String(saltBase64 || "");
    const raw = new TextEncoder().encode(`${salt}:${pinText}`);
    return bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)))
}

function getThrottleConfig(env) {
    return {
        windowSec: Math.max(10, Math.floor(Number(env.AUTH_THROTTLE_WINDOW_SEC || "300"))),
        maxFails: Math.max(1, Math.floor(Number(env.AUTH_THROTTLE_MAX_FAILS || "5"))),
        blockSec: Math.max(10, Math.floor(Number(env.AUTH_THROTTLE_BLOCK_SEC || "900")))
    }
}

function getClientIpBucket(request) {
    const raw = String(request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "").split(",")[0].trim();
    if (!raw) return "unknown";
    if (raw.includes(".")) {
        const parts = raw.split(".");
        return parts.length >= 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : raw
    }
    if (raw.includes(":")) {
        const parts = raw.split(":").filter(Boolean);
        return parts.length > 0 ? `${parts.slice(0, 4).join(":")}::` : raw
    }
    return raw
}

async function getLoginThrottleState(env, usernameNorm, ipBucket) {
    return await env.DB.prepare("SELECT fail_count, window_started_at, blocked_until FROM login_attempts WHERE username_norm = ?1 AND ip_bucket = ?2").bind(usernameNorm, ipBucket).first()
}

async function clearLoginThrottleState(env, usernameNorm, ipBucket) {
    await env.DB.prepare("DELETE FROM login_attempts WHERE username_norm = ?1 AND ip_bucket = ?2").bind(usernameNorm, ipBucket).run()
}

async function recordLoginFailure(env, usernameNorm, ipBucket, nowSec, throttleCfg, existingRow) {
    const row = existingRow || await getLoginThrottleState(env, usernameNorm, ipBucket);
    let failCount = 1,
        windowStartedAt = nowSec;
    if (row && Number(row.window_started_at || 0) > 0 && nowSec - Number(row.window_started_at || 0) <= throttleCfg.windowSec) failCount = Number(row.fail_count || 0) + 1, windowStartedAt = Number(row.window_started_at || nowSec);
    const blockedUntil = failCount >= throttleCfg.maxFails ? nowSec + throttleCfg.blockSec : 0;
    await env.DB.prepare("INSERT INTO login_attempts (username_norm, ip_bucket, fail_count, window_started_at, blocked_until, updated_at)\n      VALUES (?1, ?2, ?3, ?4, ?5, ?6)\n      ON CONFLICT(username_norm, ip_bucket)\n      DO UPDATE SET fail_count = excluded.fail_count,\n                    window_started_at = excluded.window_started_at,\n                    blocked_until = excluded.blocked_until,\n                    updated_at = excluded.updated_at").bind(usernameNorm, ipBucket, failCount, windowStartedAt, blockedUntil, nowSec).run();
    return {
        failCount: failCount,
        blockedUntil: blockedUntil
    }
}

function makeRateLimitedResponse(nowSec, blockedUntil) {
    const retryAfterMs = Math.max(0, (Number(blockedUntil || 0) - nowSec) * 1e3);
    return json({
        ok: !1,
        error: "Too many failed login attempts. Try again later.",
        code: "rate_limited",
        retryAfterMs: retryAfterMs
    }, 429, {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1e3)))
    })
}

async function maybeServeStaticAsset(env, request, url) {
    if (!env || !env.ASSETS || "function" != typeof env.ASSETS.fetch) return null;
    if ("GET" !== request.method && "HEAD" !== request.method) return null;
    if (url.pathname.startsWith("/api/")) return null;
    return await env.ASSETS.fetch(request)
}

function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader) return out;
    const chunks = cookieHeader.split(";");
    for (let i = 0; i < chunks.length; i++) {
        const part = chunks[i].trim();
        if (!part) continue;
        const idx = part.indexOf("=");
        if (idx < 0) continue;
        const k = part.slice(0, idx).trim(),
            v = part.slice(idx + 1).trim();
        try {
            out[k] = decodeURIComponent(v)
        } catch (_err) {
            out[k] = v
        }
    }
    return out
}

function classPreset(classId) {
    if (CLASS_PRESETS[classId]) return CLASS_PRESETS[classId];
    if (CLASS_PRESETS.sharpshooter) return CLASS_PRESETS.sharpshooter;
    const keys = Object.keys(CLASS_PRESETS);
    return keys.length > 0 ? CLASS_PRESETS[keys[0]] : {
        armorMax: 90,
        wallhackRadius: 90
    }
}
async function getSessionFromRequest(env, request) {
    const cookieName = env.SESSION_COOKIE_NAME || "mfa_session",
        sid = parseCookies(request.headers.get("Cookie"))[cookieName];
    if (!sid) return null;
    const now = Math.floor(nowMs() / 1e3),
        row = await env.DB.prepare("SELECT s.id as session_id, s.user_id, s.expires_at,\n            u.username, p.class_id, p.kills, p.deaths, p.damage_done, p.damage_taken\n     FROM sessions s\n     JOIN users u ON u.id = s.user_id\n     LEFT JOIN profiles p ON p.user_id = s.user_id\n     WHERE s.id = ?1").bind(sid).first();
    return row ? row.expires_at <= now ? (await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(sid).run(), null) : (await env.DB.prepare("UPDATE sessions SET last_seen_at = ?2 WHERE id = ?1").bind(sid, now).run(), {
        sessionId: row.session_id,
        userId: row.user_id,
        username: row.username,
        classId: row.class_id || "sharpshooter",
        kills: row.kills || 0,
        deaths: row.deaths || 0,
        damageDone: row.damage_done || 0,
        damageTaken: row.damage_taken || 0,
        expiresAt: row.expires_at
    }) : null
}
async function handleLogin(env, request) {
    const body = await request.json().catch(() => null);
    if (!body || "object" != typeof body) return json({
        ok: !1,
        error: "Invalid JSON body."
    }, 400);
    const usernameRaw = String(body.username || "").trim(),
        usernameNorm = String(usernameRaw || "").trim().toLowerCase();
    const pin = String(body.pin || "");
    if (! function(username) {
            return /^[a-zA-Z0-9_]{3,20}$/.test(String(username || "").trim())
        }(usernameRaw)) return json({
        ok: !1,
        error: "Username must be 3-20 chars (letters, numbers, underscore)."
    }, 400);
    if (! function(pin) {
            return /^\d{4}$/.test(String(pin || ""))
        }(pin)) return json({
        ok: !1,
        error: "PIN must be exactly 4 digits."
    }, 400);
    const now = Math.floor(nowMs() / 1e3),
        throttleCfg = getThrottleConfig(env),
        ipBucket = getClientIpBucket(request),
        throttleState = await getLoginThrottleState(env, usernameNorm, ipBucket);
    if (throttleState && Number(throttleState.blocked_until || 0) > now) return makeRateLimitedResponse(now, Number(throttleState.blocked_until || 0));
    let user = await env.DB.prepare("SELECT id, username, pin_plain, pin_hash, pin_salt, pin_algo FROM users WHERE username_norm = ?1").bind(usernameNorm).first();
    if (user) {
        let pinOk = !1;
        if (user.pin_hash && user.pin_salt && (!user.pin_algo || "sha256" === user.pin_algo)) {
            const candidate = await hashPinWithSalt(pin, user.pin_salt);
            pinOk = constantTimeEqualString(candidate, user.pin_hash)
        } else if ("string" == typeof user.pin_plain) pinOk = constantTimeEqualString(pin, user.pin_plain);
        if (!pinOk) {
            const failResult = await recordLoginFailure(env, usernameNorm, ipBucket, now, throttleCfg, throttleState);
            if (failResult.blockedUntil > now) return makeRateLimitedResponse(now, failResult.blockedUntil);
            return json({
                ok: !1,
                error: "Incorrect PIN."
            }, 401)
        }
        if (!(user.pin_hash && user.pin_salt)) {
            const saltBase64 = createPinSaltBase64(),
                pinHash = await hashPinWithSalt(pin, saltBase64);
            await env.DB.prepare("UPDATE users SET pin_hash = ?2, pin_salt = ?3, pin_algo = ?4, pin_plain = ?5 WHERE id = ?1").bind(user.id, pinHash, saltBase64, "sha256", "").run();
            user.pin_hash = pinHash, user.pin_salt = saltBase64, user.pin_algo = "sha256", user.pin_plain = ""
        }
    } else {
        const userId = randomId("usr"),
            saltBase64 = createPinSaltBase64(),
            pinHash = await hashPinWithSalt(pin, saltBase64);
        await env.DB.prepare("INSERT INTO users (id, username, username_norm, pin_plain, pin_hash, pin_salt, pin_algo, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(userId, usernameRaw, usernameNorm, "", pinHash, saltBase64, "sha256", now).run(), await async function(env, userId, classId) {
            await env.DB.prepare("INSERT INTO profiles (user_id, class_id) VALUES (?1, ?2)\n     ON CONFLICT(user_id) DO NOTHING").bind(userId, classId || "sharpshooter").run()
        }(env, userId, "sharpshooter"), user = {
            id: userId,
            username: usernameRaw,
            pin_plain: "",
            pin_hash: pinHash,
            pin_salt: saltBase64,
            pin_algo: "sha256"
        }
    }
    await clearLoginThrottleState(env, usernameNorm, ipBucket);
    const sessionId = randomId("ses"),
        sessionDays = Number(env.SESSION_DAYS || "30"),
        maxAge = Math.max(1, Math.floor(86400 * sessionDays)),
        expiresAt = now + maxAge;
    await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind(sessionId, user.id, expiresAt, now, now).run();
    const profile = await env.DB.prepare("SELECT class_id, kills, deaths, damage_done, damage_taken FROM profiles WHERE user_id = ?1").bind(user.id).first(),
        cookieName = env.SESSION_COOKIE_NAME || "mfa_session",
        secureAttr = "https:" === new URL(request.url).protocol ? " Secure;" : "",
        setCookie = `${cookieName}=${encodeURIComponent(sessionId)}; HttpOnly;${secureAttr} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
    return json({
        ok: !0,
        user: {
            id: user.id,
            username: user.username,
            classId: profile && profile.class_id || "sharpshooter",
            kills: profile && profile.kills || 0,
            deaths: profile && profile.deaths || 0,
            damageDone: profile && profile.damage_done || 0,
            damageTaken: profile && profile.damage_taken || 0
        },
        sessionExpiresAt: new Date(1e3 * expiresAt).toISOString()
    }, 200, {
        "Set-Cookie": setCookie
    })
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
}

function inferGripMode(weaponId) {
    return "pistol" === weaponId ? "one_hand" : "two_hand"
}

function resolveCameraMode(cameraMode) {
    return "third" === cameraMode ? "third" : "first"
}

function wrapRad(rad) {
    if (COORD_SYSTEM && "function" == typeof COORD_SYSTEM.wrapRad) return COORD_SYSTEM.wrapRad(rad || 0);
    let out = Number(rad || 0);
    for (; out > Math.PI;) out -= 2 * Math.PI;
    for (; out < -Math.PI;) out += 2 * Math.PI;
    return out
}

function clampPitchRad(pitch) {
    return COORD_SYSTEM && "function" == typeof COORD_SYSTEM.clampPitch ? COORD_SYSTEM.clampPitch(pitch || 0, PITCH_LIMIT_RAD) : clamp(Number(pitch || 0), -PITCH_LIMIT_RAD, PITCH_LIMIT_RAD)
}

function directionFromYawPitch(yaw, pitch) {
    if (COORD_SYSTEM && "function" == typeof COORD_SYSTEM.forwardFromYawPitch) return COORD_SYSTEM.forwardFromYawPitch(yaw || 0, pitch || 0);
    const cy = Math.cos(yaw || 0),
        sy = Math.sin(yaw || 0),
        cp = Math.cos(pitch || 0),
        len = Math.sqrt(sy * sy * cp * cp + Math.sin(pitch || 0) * Math.sin(pitch || 0) + cy * cy * cp * cp) || 1;
    return {
        x: -sy * cp / len,
        y: Math.sin(pitch || 0) / len,
        z: -cy * cp / len
    }
}

function rightFromYaw(yaw) {
    return COORD_SYSTEM && "function" == typeof COORD_SYSTEM.rightFromYaw ? COORD_SYSTEM.rightFromYaw(yaw || 0) : {
        x: Math.cos(yaw || 0),
        y: 0,
        z: -Math.sin(yaw || 0)
    }
}

function rayIntersectAabb(origin, dir, box, maxDistance) {
    let tmin = 0,
        tmax = maxDistance;
    const ox = origin.x,
        oy = origin.y,
        oz = origin.z,
        dx = dir.x,
        dy = dir.y,
        dz = dir.z;

    function axis(o, d, min, max) {
        if (Math.abs(d) < 1e-8) return o < min || o > max ? null : {
            t0: -1 / 0,
            t1: 1 / 0
        };
        const inv = 1 / d;
        let t0 = (min - o) * inv,
            t1 = (max - o) * inv;
        if (t0 > t1) {
            const tmp = t0;
            t0 = t1, t1 = tmp
        }
        return {
            t0: t0,
            t1: t1
        }
    }
    const ax = axis(ox, dx, box.min.x, box.max.x);
    if (!ax) return null;
    if (tmin = Math.max(tmin, ax.t0), tmax = Math.min(tmax, ax.t1), tmax < tmin) return null;
    const ay = axis(oy, dy, box.min.y, box.max.y);
    if (!ay) return null;
    if (tmin = Math.max(tmin, ay.t0), tmax = Math.min(tmax, ay.t1), tmax < tmin) return null;
    const az = axis(oz, dz, box.min.z, box.max.z);
    return az ? (tmin = Math.max(tmin, az.t0), tmax = Math.min(tmax, az.t1), tmax < tmin || tmin < 0 || tmin > maxDistance ? null : tmin) : null
}

function getCameraStateForEntity(entity) {
    const cameraMode = resolveCameraMode(entity && entity.cameraMode);
    return AIM_PARITY && AIM_PARITY.getCameraState ? AIM_PARITY.getCameraState({
        cameraMode: cameraMode,
        x: entity && entity.x || 0,
        z: entity && entity.z || 0,
        feetY: entity && entity.feetY || 0,
        yaw: entity && entity.yaw || 0,
        pitch: entity && entity.pitch || 0,
        shoulderSide: entity && "left" === entity.shoulderSide ? "left" : "right"
    }) : {
        mode: cameraMode,
        cameraDistance: "third" === cameraMode ? 4.4 : 0,
        position: {
            x: entity && entity.x || 0,
            y: (entity && entity.feetY || 0) + ENTITY_EYE_HEIGHT,
            z: entity && entity.z || 0
        },
        basis: null
    }
}

function getContinuousWeaponConfig(weaponId) {
    if (!weaponId || !CONTINUOUS_WEAPONS_PRIM) return null;
    const cfg = CONTINUOUS_WEAPONS_PRIM[weaponId];
    return cfg && "object" == typeof cfg ? cfg : null
}

function isContinuousWeapon(weaponId) {
    return !!getContinuousWeaponConfig(weaponId)
}

function getWeaponLockProfile(weaponId) {
    const cfg = getContinuousWeaponConfig(weaponId) || {},
        profileKey = String(cfg.profile || weaponId || "beam_default");
    return function(profile) {
        return profile = profile || {}, {
            overlapThreshold: Math.max(0, Number(profile.overlap_threshold || profile.overlapThreshold || 0)),
            sticky: !1 !== profile.sticky,
            requireLos: !1 !== profile.require_los && !1 !== profile.requireLos,
            requireRange: !1 !== profile.require_range && !1 !== profile.requireRange
        }
    }(LOCK_PROFILES_PRIM[profileKey] || LOCK_PROFILES_PRIM.beam_default || {})
}

function shotgunFalloffDamage(baseDamage, distance) {
    if (distance <= 8) return baseDamage;
    if (distance >= 24) return Math.max(3, Math.round(.25 * baseDamage));
    const scale = 1 - .75 * ((distance - 8) / 16);
    return Math.max(3, Math.round(baseDamage * scale))
}

function makeEntityBodyAabb(entity) {
    const hw = .5 * BODY_HITBOX_SIZE[0],
        hh = .5 * BODY_HITBOX_SIZE[1],
        hd = .5 * BODY_HITBOX_SIZE[2],
        cy = (entity.feetY || 0) + BODY_HITBOX_OFFSET;
    return {
        min: {
            x: entity.x - hw,
            y: cy - hh,
            z: entity.z - hd
        },
        max: {
            x: entity.x + hw,
            y: cy + hh,
            z: entity.z + hd
        }
    }
}

function makeEntityHeadAabb(entity) {
    const hw = .5 * HEAD_HITBOX_SIZE[0],
        hh = .5 * HEAD_HITBOX_SIZE[1],
        hd = .5 * HEAD_HITBOX_SIZE[2],
        cy = (entity.feetY || 0) + HEAD_HITBOX_OFFSET;
    return {
        min: {
            x: entity.x - hw,
            y: cy - hh,
            z: entity.z - hd
        },
        max: {
            x: entity.x + hw,
            y: cy + hh,
            z: entity.z + hd
        }
    }
}

function sphereIntersectsAabb(x, y, z, radius, box) {
    const dx = x - clamp(x, box.min.x, box.max.x),
        dy = y - clamp(y, box.min.y, box.max.y),
        dz = z - clamp(z, box.min.z, box.max.z);
    return dx * dx + dy * dy + dz * dz <= radius * radius
}

function aabbTopAtXZ(x, z, box, radius) {
    return intersectsXZCircleAabb(x, z, radius, box) ? box.max.y : null
}

function aabbBottomAtXZ(x, z, box, radius) {
    return intersectsXZCircleAabb(x, z, radius, box) ? box.min.y : null
}
const WORLD_CONFIG = WORLD_LAYOUT && WORLD_LAYOUT.getConfig ? WORLD_LAYOUT.getConfig({}) : {
        baseWorldSize: Number(WORLD_PRIM.base_world_size || 50),
        areaScale: Number(WORLD_PRIM.area_scale || 5),
        worldSize: Number(WORLD_PRIM.world_size || Math.round(Number(WORLD_PRIM.base_world_size || 50) * Math.sqrt(Number(WORLD_PRIM.area_scale || 5)))),
        margin: Number(WORLD_PRIM.margin || 2),
        min: Number(WORLD_PRIM.min || Number(WORLD_PRIM.margin || 2)),
        max: Number(WORLD_PRIM.max || Number(WORLD_PRIM.world_size || 50) - Number(WORLD_PRIM.margin || 2)),
        center: Number(WORLD_PRIM.center || .5 * Number(WORLD_PRIM.world_size || 50)),
        seed: String(WORLD_PRIM.seed_default || "mineshoot-v1"),
        chunkSize: Math.max(4, Math.floor(Number(WORLD_PRIM.chunk_size || 16))),
        interestRadiusChunks: Math.max(1, Math.floor(Number(WORLD_PRIM.interest_radius_chunks || 2)))
    },
    BASE_WORLD_SIZE = Number(WORLD_CONFIG.baseWorldSize || 50),
    WORLD_AREA_SCALE = Number(WORLD_CONFIG.areaScale || 5),
    WORLD_SIZE = Number(WORLD_CONFIG.worldSize || Math.round(BASE_WORLD_SIZE * Math.sqrt(WORLD_AREA_SCALE))),
    WORLD_MARGIN = Number(WORLD_CONFIG.margin || 2),
    WORLD_MIN = Number(WORLD_CONFIG.min || WORLD_MARGIN),
    WORLD_MAX = Number(WORLD_CONFIG.max || WORLD_SIZE - WORLD_MARGIN),
    WORLD_CENTER = Number(WORLD_CONFIG.center || .5 * WORLD_SIZE),
    WORLD_SEED = String(WORLD_CONFIG.seed || "mineshoot-v1"),
    WORLD_CHUNK_SIZE = Math.max(4, Math.floor(Number(WORLD_CONFIG.chunkSize || 16))),
    WORLD_INTEREST_RADIUS_CHUNKS = Math.max(1, Math.floor(Number(WORLD_CONFIG.interestRadiusChunks || 2))),
    ENTITY_EYE_HEIGHT = Number(COORDS_PRIM.eye_offset_y || 1.6),
    ENTITY_HEIGHT = Number(ENTITY_PRIM.capsule_height || 1.7),
    ENTITY_RADIUS = Number(ENTITY_PRIM.capsule_radius || .58);

function makeAabb(cx, cy, cz, w, h, d) {
    const hw = .5 * w,
        hh = .5 * h,
        hd = .5 * d;
    return {
        min: {
            x: cx - hw,
            y: cy - hh,
            z: cz - hd
        },
        max: {
            x: cx + hw,
            y: cy + hh,
            z: cz + hd
        }
    }
}
const SERVER_WORLD_SOLIDS = WORLD_LAYOUT && WORLD_LAYOUT.buildSolidSpecs ? WORLD_LAYOUT.buildSolidSpecs({
        areaScale: WORLD_AREA_SCALE,
        worldSize: WORLD_SIZE,
        margin: WORLD_MARGIN,
        min: WORLD_MIN,
        max: WORLD_MAX,
        center: WORLD_CENTER,
        seed: WORLD_SEED,
        chunkSize: WORLD_CHUNK_SIZE,
        interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS
    }) : [],
    SERVER_WORLD_COLLIDERS = function(solids) {
        const colliders = [],
            list = Array.isArray(solids) ? solids : [];
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            colliders.push(makeAabb(s.x, s.y, s.z, s.w, s.h, s.d))
        }
        return colliders
    }(SERVER_WORLD_SOLIDS),
    WORLD_CHUNK_INDEX = WORLD_LAYOUT && WORLD_LAYOUT.buildChunkIndex ? WORLD_LAYOUT.buildChunkIndex(SERVER_WORLD_SOLIDS, WORLD_CHUNK_SIZE) : new Map;

function intersectsXZCircleAabb(x, z, radius, box) {
    const dx = x - clamp(x, box.min.x, box.max.x),
        dz = z - clamp(z, box.min.z, box.max.z);
    return dx * dx + dz * dz < radius * radius
}

function isBlockedAt(colliders, x, z, feetY, height = ENTITY_HEIGHT, radius = ENTITY_RADIUS) {
    if (!colliders || 0 === colliders.length) return !1;
    const headY = feetY + height;
    for (let i = 0; i < colliders.length; i++) {
        const box = colliders[i];
        if (box && (!(headY <= box.min.y + .001 || feetY >= box.max.y - .001) && intersectsXZCircleAabb(x, z, radius, box))) return !0
    }
    return !1
}
export class GlobalArenaRoom extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env), this.ctx = ctx, this.env = env, this.clients = new Map, this.playerSockets = new Map, this.players = new Map, this.bots = new Map, this.throwables = new Map, this.molotovZones = new Map, this.nextThrowableId = 1, this.hadThrowablesLastTick = !1, this.tickHandle = null, this.lastTickAt = nowMs(), this.roomName = env.ROOM_NAME || "global", this.boundsMin = WORLD_MIN, this.boundsMax = WORLD_MAX, this.chunkSize = WORLD_CHUNK_SIZE, this.interestRadiusChunks = WORLD_INTEREST_RADIUS_CHUNKS, this.protocolVersion = 2, this.worldSolids = SERVER_WORLD_SOLIDS, this.worldColliders = SERVER_WORLD_COLLIDERS, this.worldChunkIndex = WORLD_CHUNK_INDEX, this.ensureBots()
    }
    pickSafeSpawn(options = {}) {
        return function(colliders, options = {}) {
            const padding = "number" == typeof options.padding ? options.padding : 8,
                tries = Math.max(1, Math.floor(options.tries || 80)),
                feetY = "number" == typeof options.feetY ? options.feetY : 0,
                height = "number" == typeof options.height ? options.height : ENTITY_HEIGHT,
                radius = "number" == typeof options.radius ? options.radius : ENTITY_RADIUS,
                min = WORLD_MIN + padding,
                max = WORLD_MAX - padding;
            for (let i = 0; i < tries; i++) {
                const x = min + Math.random() * (max - min),
                    z = min + Math.random() * (max - min);
                if (!isBlockedAt(colliders, x, z, feetY, height, radius)) return {
                    x: x,
                    z: z
                }
            }
            return {
                x: min + Math.random() * (max - min),
                z: min + Math.random() * (max - min)
            }
        }(this.worldColliders, {
            padding: "number" == typeof options.padding ? options.padding : 8,
            tries: "number" == typeof options.tries ? options.tries : 90,
            feetY: "number" == typeof options.feetY ? options.feetY : 0,
            height: "number" == typeof options.height ? options.height : ENTITY_HEIGHT,
            radius: "number" == typeof options.radius ? options.radius : ENTITY_RADIUS
        })
    }
    chunkKey(cx, cz) {
        return WORLD_LAYOUT && WORLD_LAYOUT.makeChunkKey ? WORLD_LAYOUT.makeChunkKey(cx, cz) : `${cx}:${cz}`
    }
    chunkForPosition(x, z) {
        return WORLD_LAYOUT && WORLD_LAYOUT.getChunkForPosition ? WORLD_LAYOUT.getChunkForPosition(x, z, this.chunkSize) : {
            cx: Math.floor(x / this.chunkSize),
            cz: Math.floor(z / this.chunkSize)
        }
    }
    socketsForUser(userId) {
        return this.playerSockets.has(userId) || this.playerSockets.set(userId, new Set), this.playerSockets.get(userId)
    }
    moveEntityHorizontalWithCollision(entity, desiredX, desiredZ, feetY) {
        if (!entity) return;
        const targetX = clamp(desiredX, this.boundsMin, this.boundsMax),
            targetZ = clamp(desiredZ, this.boundsMin, this.boundsMax),
            startFeetY = "number" == typeof feetY ? clamp(feetY, 0, 16) : entity.feetY || 0,
            startX = entity.x,
            startZ = entity.z,
            dx = targetX - startX,
            dz = targetZ - startZ,
            dist = Math.sqrt(dx * dx + dz * dz),
            steps = Math.max(1, Math.ceil(dist / COLLISION_STEP));
        let curX = startX,
            curZ = startZ;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps,
                nextX = startX + dx * t,
                nextZ = startZ + dz * t;
            isBlockedAt(this.worldColliders, nextX, curZ, startFeetY, ENTITY_HEIGHT, ENTITY_RADIUS) || (curX = nextX), isBlockedAt(this.worldColliders, curX, nextZ, startFeetY, ENTITY_HEIGHT, ENTITY_RADIUS) || (curZ = nextZ)
        }
        entity.x = curX, entity.z = curZ
    }
    findLandingSurfaceY(x, z, currentFeetY, nextFeetY) {
        let best = 0;
        for (let i = 0; i < this.worldColliders.length; i++) {
            const top = aabbTopAtXZ(x, z, this.worldColliders[i], .9 * ENTITY_RADIUS);
            null !== top && (top <= currentFeetY + .001 && top >= nextFeetY - .001 && top > best && (best = top))
        }
        return best
    }
    findCeilingY(x, z, currentHeadY, nextHeadY) {
        let best = null;
        for (let i = 0; i < this.worldColliders.length; i++) {
            const bottom = aabbBottomAtXZ(x, z, this.worldColliders[i], .9 * ENTITY_RADIUS);
            null !== bottom && (bottom >= currentHeadY - .001 && bottom <= nextHeadY + .001 && (null === best || bottom < best) && (best = bottom))
        }
        return best
    }
    sendChunkSnapshot(ws, chunk) {
        chunk && this.send(ws, {
            t: "chunk_snapshot",
            chunk: {
                key: chunk.key,
                version: Number(chunk.version || 1),
                solids: Array.isArray(chunk.solids) ? chunk.solids : [],
                decor: Array.isArray(chunk.decor) ? chunk.decor : [],
                blockers: Array.isArray(chunk.blockers) ? chunk.blockers : [],
                nav: Array.isArray(chunk.nav) ? chunk.nav : []
            }
        })
    }
    updateChunkInterest(player, force, explicitCenter) {
        if (!player) return;
        player.chunkSubs || (player.chunkSubs = new Set);
        const sockets = this.socketsForUser(player.id);
        if (0 === sockets.size) return;
        const center = explicitCenter || this.chunkForPosition(player.x, player.z);
        player.chunkCenterX = center.cx, player.chunkCenterZ = center.cz;
        const wanted = new Set;
        for (let dz = -this.interestRadiusChunks; dz <= this.interestRadiusChunks; dz++)
            for (let dx = -this.interestRadiusChunks; dx <= this.interestRadiusChunks; dx++) {
                const cx = center.cx + dx,
                    cz = center.cz + dz,
                    key = this.chunkKey(cx, cz);
                if (wanted.add(key), force || !player.chunkSubs.has(key)) {
                    const chunk = this.worldChunkIndex.get(key);
                    if (!chunk) continue;
                    for (const ws of sockets.values()) this.sendChunkSnapshot(ws, chunk)
                }
            }
        for (const existingKey of player.chunkSubs.values())
            if (!wanted.has(existingKey))
                for (const ws of sockets.values()) this.send(ws, {
                    t: "chunk_delta",
                    key: existingKey,
                    version: nowMs(),
                    op: "remove"
                });
        player.chunkSubs = wanted
    }
    ensurePlayerCoreFields(player) {
        player.intent || (player.intent = {
            moveX: 0,
            moveZ: 0,
            jumpHeld: !1,
            sprint: !1,
            actions: []
        }), "number" == typeof player.velY && Number.isFinite(player.velY) || (player.velY = 0), "boolean" != typeof player.grounded && (player.grounded = !0), "number" == typeof player.jumpHoldTimerSec && Number.isFinite(player.jumpHoldTimerSec) || (player.jumpHoldTimerSec = 0), "boolean" != typeof player.jumpHeldPrev && (player.jumpHeldPrev = !1), player.lastThrowAt && "object" == typeof player.lastThrowAt || (player.lastThrowAt = {}), player.lastShotAt && "object" == typeof player.lastShotAt || (player.lastShotAt = {}), player.chunkSubs || (player.chunkSubs = new Set), "boolean" != typeof player.beamIntentActive && (player.beamIntentActive = !1), "string" != typeof player.beamWeaponId && (player.beamWeaponId = ""), player.beamLockState && "object" == typeof player.beamLockState || (player.beamLockState = createBeamLockState()), "string" != typeof player.beamTargetId && (player.beamTargetId = ""), "number" == typeof player.beamActiveUntil && Number.isFinite(player.beamActiveUntil) || (player.beamActiveUntil = 0), "number" == typeof player.beamHeat && Number.isFinite(player.beamHeat) || (player.beamHeat = 0), "boolean" != typeof player.beamOverheated && (player.beamOverheated = !1), "number" == typeof player.beamOverheatedUntil && Number.isFinite(player.beamOverheatedUntil) || (player.beamOverheatedUntil = 0), "number" == typeof player.lastPlasmaTickAt && Number.isFinite(player.lastPlasmaTickAt) || (player.lastPlasmaTickAt = 0), player.cameraMode = resolveCameraMode(player.cameraMode), player.shoulderSide = "left" === player.shoulderSide ? "left" : "right"
    }
    simulatePlayerMovement(player, dtSec) {
        if (!player || !player.alive) return;
        this.ensurePlayerCoreFields(player);
        const moveX = clamp(Number(player.intent.moveX || 0), -1, 1),
            moveZ = clamp(Number(player.intent.moveZ || 0), -1, 1),
            sprint = !!player.intent.sprint,
            jumpHeld = !!player.intent.jumpHeld,
            jumpJustPressed = jumpHeld && !player.jumpHeldPrev,
            jumpJustReleased = !jumpHeld && player.jumpHeldPrev;
        player.jumpHeldPrev = jumpHeld, jumpJustPressed && player.grounded && (player.velY = 8.8, player.grounded = !1, player.jumpHoldTimerSec = .2), jumpJustReleased && player.velY > 0 && (player.velY *= .42, player.jumpHoldTimerSec = 0), jumpHeld && player.jumpHoldTimerSec > 0 && player.velY > 0 && (player.velY += 16 * dtSec, player.jumpHoldTimerSec = Math.max(0, player.jumpHoldTimerSec - dtSec));
        const forward = directionFromYawPitch(player.yaw || 0, 0),
            right = rightFromYaw(player.yaw || 0);
        let worldMoveX = right.x * moveX + forward.x * moveZ,
            worldMoveZ = right.z * moveX + forward.z * moveZ;
        const vecLen = Math.sqrt(worldMoveX * worldMoveX + worldMoveZ * worldMoveZ),
            moving = vecLen > 1e-4;
        moving && (worldMoveX /= vecLen, worldMoveZ /= vecLen);
        const speed = sprint ? 11 : 8,
            desiredX = player.x + worldMoveX * speed * dtSec,
            desiredZ = player.z + worldMoveZ * speed * dtSec;
        this.moveEntityHorizontalWithCollision(player, desiredX, desiredZ, player.feetY), player.moveSpeedNorm = moving ? clamp(speed / 11, 0, 1.4) : 0, player.sprinting = moving && sprint, moving ? player.grounded ? player.animState = player.sprinting ? "sprint" : player.moveSpeedNorm > .45 ? "run" : "walk" : player.animState = "airborne" : player.animState = player.grounded ? "idle" : "airborne", player.velY -= 18 * dtSec;
        const currentFeetY = player.feetY || 0;
        let nextFeetY = currentFeetY + player.velY * dtSec;
        if (player.velY <= 0) {
            const landingY = this.findLandingSurfaceY(player.x, player.z, currentFeetY, nextFeetY);
            nextFeetY <= landingY + .001 ? (nextFeetY = landingY, player.velY = 0, player.grounded = !0, player.jumpHoldTimerSec = 0) : player.grounded = !1
        } else {
            const currentHeadY = currentFeetY + ENTITY_HEIGHT,
                nextHeadY = nextFeetY + ENTITY_HEIGHT,
                ceilingY = this.findCeilingY(player.x, player.z, currentHeadY, nextHeadY);
            null !== ceilingY && nextHeadY >= ceilingY - .001 && (nextFeetY = ceilingY - ENTITY_HEIGHT, player.velY = 0, player.jumpHoldTimerSec = 0), player.grounded = !1
        }
        nextFeetY < 0 && (nextFeetY = 0, player.velY = 0, player.grounded = !0, player.jumpHoldTimerSec = 0), player.feetY = clamp(nextFeetY, 0, 16)
    }
    ensureBots() {
        const desired = Math.max(0, Number(this.env.BOT_COUNT || "6"));
        for (let i = 0; i < desired; i++) {
            const id = `bot-${i+1}`;
            if (this.bots.has(id)) continue;
            const classId = "sharpshooter",
                preset = classPreset(classId),
                spawn = this.pickSafeSpawn({
                    padding: 8,
                    tries: 120,
                    feetY: 0,
                    height: ENTITY_HEIGHT,
                    radius: ENTITY_RADIUS
                });
            this.bots.set(id, {
                id: id,
                kind: "bot",
                username: `BOT_${i+1}`,
                classId: classId,
                queuedClassId: null,
                x: spawn.x,
                feetY: 0,
                z: spawn.z,
                yaw: Math.random() * Math.PI * 2,
                pitch: 0,
                cameraMode: "first",
                shoulderSide: "right",
                velY: 0,
                grounded: !0,
                hp: MAX_HP,
                hpMax: MAX_HP,
                armor: preset.armorMax,
                armorMax: preset.armorMax,
                wallhackRadius: preset.wallhackRadius,
                alive: !0,
                respawnAt: 0,
                lastDamageAt: 0,
                weaponId: "rifle",
                moveSpeedNorm: 0,
                sprinting: !1,
                animState: "idle",
                animPhase: Math.random() * Math.PI * 2,
                gripMode: "two_hand",
                aimPitch: 0,
                beamIntentActive: !1,
                beamWeaponId: "",
                beamLockState: createBeamLockState(),
                beamTargetId: "",
                beamActiveUntil: 0,
                beamHeat: 0,
                beamOverheated: !1,
                beamOverheatedUntil: 0,
                lastPlasmaTickAt: 0,
                aiDirX: Math.cos(Math.random() * Math.PI * 2),
                aiDirZ: Math.sin(Math.random() * Math.PI * 2),
                aiSpeed: 2.2,
                aiTurnTimer: 1 + 3 * Math.random(),
                lastShotAt: {},
                lastThrowAt: {},
                chunkSubs: new Set
            })
        }
    }
    ensureTick() {
        this.tickHandle || (this.lastTickAt = nowMs(), this.tickHandle = setInterval(() => {
            try {
                this.tick()
            } catch (err) {
                console.error("tick error", err)
            }
        }, NETWORK_TICK_INTERVAL_MS))
    }
    stopTickIfEmpty() {
        this.clients.size > 0 || this.tickHandle && (clearInterval(this.tickHandle), this.tickHandle = null)
    }
    async fetch(request) {
        const url = new URL(request.url);
        if ("websocket" !== request.headers.get("Upgrade")) return "/state" === url.pathname ? json({
            ok: !0,
            players: this.players.size,
            bots: this.bots.size
        }) : new Response("Expected websocket upgrade", {
            status: 426
        });
        const userId = url.searchParams.get("userId"),
            username = url.searchParams.get("username") || "player",
            classId = url.searchParams.get("classId") || "sharpshooter";
        if (!userId) return new Response("Missing userId", {
            status: 400
        });
        const pair = new WebSocketPair,
            client = pair[0],
            server = pair[1];
        this.ctx.acceptWebSocket(server), server.serializeAttachment({
            userId: userId,
            username: username,
            classId: classId
        }), this.clients.set(server, {
            userId: userId
        }), this.socketsForUser(userId).add(server);
        const player = this.ensurePlayer(userId, username, classId);
        return this.ensureTick(), this.sendWelcome(server, player), this.updateChunkInterest(player, !0), this.broadcastEntitySnapshot(), this.broadcastThrowableSnapshot(!0), new Response(null, {
            status: 101,
            webSocket: client
        })
    }
    sendWelcome(ws, player) {
        this.send(ws, {
            t: "welcome",
            selfId: player.id,
            roomId: this.roomName,
            protocolVersion: this.protocolVersion,
            tickRate: NETWORK_TICK_RATE_HZ,
            chunkSize: this.chunkSize,
            interestRadiusChunks: this.interestRadiusChunks
        })
    }
    ensurePlayer(userId, username, classId) {
        if (this.players.has(userId)) {
            const p = this.players.get(userId);
            return p.username = username || p.username, this.ensurePlayerCoreFields(p), "string" != typeof p.animState && (p.animState = "idle"), "number" == typeof p.animPhase && Number.isFinite(p.animPhase) || (p.animPhase = 0), VALID_GRIP_MODES.has(p.gripMode) || (p.gripMode = inferGripMode(p.weaponId || "rifle")), "number" == typeof p.aimPitch && Number.isFinite(p.aimPitch) || (p.aimPitch = p.pitch || 0), p
        }
        const preset = classPreset(classId),
            spawn = this.pickSafeSpawn({
                padding: 8,
                tries: 120,
                feetY: 0,
                height: ENTITY_HEIGHT,
                radius: ENTITY_RADIUS
            }),
            p = {
                id: userId,
                kind: "player",
                username: username,
                classId: classId,
                queuedClassId: null,
                x: spawn.x,
                feetY: 0,
                z: spawn.z,
                yaw: 0,
                pitch: 0,
                cameraMode: "first",
                shoulderSide: "right",
                velY: 0,
                grounded: !0,
                hp: MAX_HP,
                hpMax: MAX_HP,
                armor: preset.armorMax,
                armorMax: preset.armorMax,
                wallhackRadius: preset.wallhackRadius,
                alive: !0,
                respawnAt: 0,
                lastDamageAt: 0,
                seq: 0,
                lastShotAt: {},
                lastThrowAt: {},
                weaponId: "rifle",
                moveSpeedNorm: 0,
                sprinting: !1,
                animState: "idle",
                animPhase: Math.random() * Math.PI * 2,
                gripMode: "two_hand",
                aimPitch: 0,
                beamIntentActive: !1,
                beamWeaponId: "",
                beamLockState: createBeamLockState(),
                beamTargetId: "",
                beamActiveUntil: 0,
                beamHeat: 0,
                beamOverheated: !1,
                beamOverheatedUntil: 0,
                lastPlasmaTickAt: 0,
                jumpHoldTimerSec: 0,
                jumpHeldPrev: !1,
                intent: {
                    moveX: 0,
                    moveZ: 0,
                    jumpHeld: !1,
                    sprint: !1,
                    actions: []
                },
                chunkSubs: new Set
            };
        return this.players.set(userId, p), p
    }
    send(ws, obj) {
        try {
            ws.send(JSON.stringify(obj))
        } catch (_err) {}
    }
    broadcast(obj) {
        const all = this.ctx.getWebSockets(),
            payload = JSON.stringify(obj);
        for (let i = 0; i < all.length; i++) try {
            all[i].send(payload)
        } catch (_err) {}
    }
    handleInput(player, msg) {
        if (!player) return;
        this.ensurePlayerCoreFields(player), "number" == typeof msg.seq && (player.seq = Math.max(player.seq, msg.seq)), "number" == typeof msg.yaw && (player.yaw = wrapRad(msg.yaw)), "number" == typeof msg.pitch && (player.pitch = clampPitchRad(msg.pitch)), player.aimPitch = player.pitch, player.intent.moveX = clamp(Number(msg.moveX || 0), -1, 1), player.intent.moveZ = clamp(Number(msg.moveZ || 0), -1, 1), player.intent.jumpHeld = !!msg.jumpHeld, player.intent.sprint = !!msg.sprint, player.intent.actions = Array.isArray(msg.actions) ? msg.actions.slice(0, 16) : [], player.cameraMode = resolveCameraMode(msg.cameraMode), player.shoulderSide = "left" === msg.shoulderSide ? "left" : "right", VALID_GRIP_MODES.has(player.gripMode) || (player.gripMode = inferGripMode(player.weaponId || "rifle"))
    }
    getEntityById(entityId) {
        return this.players.has(entityId) ? this.players.get(entityId) : this.bots.has(entityId) ? this.bots.get(entityId) : null
    }
    eachCombatEntity(callback) {
        for (const player of this.players.values()) callback(player);
        for (const bot of this.bots.values()) callback(bot)
    }
    raycastWorldDistance(origin, dir, maxRange) {
        let best = 1 / 0;
        for (let i = 0; i < this.worldColliders.length; i++) {
            const hit = rayIntersectAabb(origin, dir, this.worldColliders[i], maxRange);
            null !== hit && hit < best && (best = hit)
        }
        return best
    }
    raycastEntityHit(shooter, origin, dir, maxRange) {
        let best = null;
        return this.eachCombatEntity(target => {
            if (!target || !target.alive || target.id === shooter.id) return;
            const bodyBox = makeEntityBodyAabb(target),
                headBox = makeEntityHeadAabb(target),
                bodyDist = rayIntersectAabb(origin, dir, bodyBox, maxRange),
                headDist = rayIntersectAabb(origin, dir, headBox, maxRange);
            let hitDist = null,
                hitType = "body";
            null !== headDist && null !== bodyDist ? (hitDist = Math.min(headDist, bodyDist), hitType = headDist <= bodyDist ? "head" : "body") : null !== headDist ? (hitDist = headDist, hitType = "head") : null !== bodyDist && (hitDist = bodyDist, hitType = "body"), null !== hitDist && (!best || hitDist < best.distance) && (best = {
                target: target,
                distance: hitDist,
                hitType: hitType
            })
        }), best
    }
    hasWorldLineOfSight(origin, targetPos, maxRange) {
        if (!origin || !targetPos) return !1;
        const delta_x = targetPos.x - origin.x,
            delta_y = targetPos.y - origin.y,
            delta_z = targetPos.z - origin.z,
            dist = Math.sqrt(delta_x * delta_x + delta_y * delta_y + delta_z * delta_z) || 0;
        if (dist <= .001) return !1;
        if ("number" == typeof maxRange && dist > maxRange) return !1;
        const dir = {
            x: delta_x / dist,
            y: delta_y / dist,
            z: delta_z / dist
        };
        return this.raycastWorldDistance(origin, dir, Math.max(0, dist - .15)) === 1 / 0
    }
    overlapAreaWithReticle(cameraState, reticleRect, entity) {
        if (!AIM_PARITY || !AIM_PARITY.projectAabbToNdcRect || !AIM_PARITY.rectOverlapArea) return 0;
        let area = 0;
        const bodyRect = AIM_PARITY.projectAabbToNdcRect(cameraState, makeEntityBodyAabb(entity));
        bodyRect && (area += AIM_PARITY.rectOverlapArea(bodyRect, reticleRect));
        const headRect = AIM_PARITY.projectAabbToNdcRect(cameraState, makeEntityHeadAabb(entity));
        return headRect && (area += AIM_PARITY.rectOverlapArea(headRect, reticleRect)), area
    }
    buildBeamLockCandidates(shooter, weaponId, maxRange) {
        const cameraState = getCameraStateForEntity(shooter),
            cameraMode = resolveCameraMode(shooter && shooter.cameraMode),
            reticleKind = function(weaponId) {
                const cfg = getContinuousWeaponConfig(weaponId) || {};
                return String(cfg.reticle_kind || cfg.reticleKind || "plasma")
            }(weaponId),
            reticleSizePx = function(kind, cameraMode, cameraDistance) {
                return AIM_PARITY && AIM_PARITY.getReticleSizePx ? Number(AIM_PARITY.getReticleSizePx(kind, cameraMode, cameraDistance) || 0) : "plasma" === kind ? 220 : 300
            }(reticleKind, cameraMode, cameraState.cameraDistance || 0),
            reticleRect = AIM_PARITY && AIM_PARITY.buildReticleRectNdc ? AIM_PARITY.buildReticleRectNdc(reticleSizePx, AIM_VIEWPORT.width, AIM_VIEWPORT.height) : {
                minX: -.12,
                maxX: .12,
                minY: -.12,
                maxY: .12
            },
            candidates = [];
        return this.eachCombatEntity(target => {
            if (!target || !target.alive || target.id === shooter.id) return;
            const overlapArea = this.overlapAreaWithReticle(cameraState, reticleRect, target),
                corePos = (x = target.x, y = (target.feetY || 0) + BODY_HITBOX_OFFSET, z = target.z, {
                    x: x || 0,
                    y: y || 0,
                    z: z || 0
                });
            var x, y, z;
            const dist = function(a, b) {
                    const dx = (a.x || 0) - (b.x || 0),
                        dy = (a.y || 0) - (b.y || 0),
                        dz = (a.z || 0) - (b.z || 0);
                    return Math.sqrt(dx * dx + dy * dy + dz * dz)
                }(cameraState.position, corePos),
                inRange = dist <= maxRange,
                hasLos = !(overlapArea > 0 && inRange) || this.hasWorldLineOfSight(cameraState.position, corePos, maxRange);
            candidates.push({
                targetId: target.id,
                overlapArea: overlapArea,
                distance: dist,
                inRange: inRange,
                hasLos: hasLos,
                alive: !0,
                targetRef: target,
                corePos: corePos
            })
        }), {
            cameraState: cameraState,
            candidates: candidates
        }
    }
    resolveBeamLock(shooter, weaponId, maxRange, overheated) {
        shooter.beamLockState && "object" == typeof shooter.beamLockState || (shooter.beamLockState = createBeamLockState());
        const built = this.buildBeamLockCandidates(shooter, weaponId, maxRange),
            lockResult = stepBeamLock(shooter.beamLockState, {
                triggerHeld: !!shooter.beamIntentActive,
                overheated: !!overheated,
                candidates: built.candidates
            }, getWeaponLockProfile(weaponId));
        shooter.beamLockState = lockResult && lockResult.state ? lockResult.state : shooter.beamLockState;
        const selectedCandidate = lockResult && lockResult.target ? lockResult.target : null;
        return {
            target: selectedCandidate ? selectedCandidate.targetRef : null,
            targetCorePos: selectedCandidate ? selectedCandidate.corePos : null,
            reason: lockResult && lockResult.reason ? lockResult.reason : "searching",
            overlapArea: Number(shooter.beamLockState.overlapArea || 0),
            candidateCount: Number(shooter.beamLockState.candidateCount || 0),
            overlapCount: Number(shooter.beamLockState.overlapCount || 0),
            cameraState: built.cameraState
        }
    }
    getAimDirection(cameraState, yaw, pitch, ndcX, ndcY) {
        return AIM_PARITY && AIM_PARITY.ndcOffsetToWorldDir ? AIM_PARITY.ndcOffsetToWorldDir(cameraState, Number(ndcX || 0), Number(ndcY || 0)) : ndcX || ndcY ? directionFromYawPitch((yaw || 0) - .08 * ndcX, (pitch || 0) + .08 * ndcY) : directionFromYawPitch(yaw || 0, pitch || 0)
    }
    applyDamage(target, damage) {
        if (!target || !target.alive) return null;
        const now = nowMs();
        target.lastDamageAt = now;
        let remaining = Math.max(1, Math.round(damage));
        if (target.armor > 0) {
            const absorbed = Math.min(target.armor, remaining);
            target.armor -= absorbed, remaining -= absorbed
        }
        remaining > 0 && (target.hp = Math.max(0, target.hp - remaining));
        let killed = !1;
        return target.hp <= 0 && target.alive && (killed = !0, target.alive = !1, target.respawnAt = now + 2200), {
            id: target.id,
            hp: target.hp,
            armor: target.armor,
            killed: killed
        }
    }
    emitDamage(sourceId, target, out, hitType) {
        this.broadcast({
            t: "damage_event",
            targetId: target.id,
            sourceId: sourceId,
            health: out.hp,
            armor: out.armor,
            hitType: hitType || "body"
        }), out.killed && this.broadcast({
            t: "death_respawn",
            entityId: target.id,
            respawnAt: target.respawnAt,
            classApplied: target.classId
        })
    }
    handleFireIntent(player, msg) {
        if (!player || !player.alive) return;
        const weaponId = String(msg.weaponId || player.weaponId || "rifle"),
            stats = WEAPON_STATS[weaponId];
        if (!stats) return;
        if (player.weaponId = weaponId, player.gripMode = inferGripMode(weaponId), isContinuousWeapon(weaponId)) return void this.handleBeamIntent(player, {
            weaponId: weaponId,
            active: !0
        });
        const now = nowMs();
        if (now - (player.lastShotAt[weaponId] || 0) < stats.cooldownMs) return;
        player.lastShotAt[weaponId] = now;
        const cameraState = getCameraStateForEntity(player),
            origin = cameraState.position || {
                x: player.x,
                y: (player.feetY || 0) + ENTITY_EYE_HEIGHT,
                z: player.z
            },
            centerDir = this.getAimDirection(cameraState, player.yaw || 0, player.pitch || 0, 0, 0);
        const hintedTargetId = "string" == typeof msg.targetId ? String(msg.targetId).replace(/^net:/, "") : "",
            hintedHitType = "head" === msg.hitType ? "head" : "body";
        if (hintedTargetId) {
            const hintedTarget = this.getEntityById(hintedTargetId);
            if (hintedTarget && hintedTarget.alive && hintedTarget.id !== player.id) {
                const corePos = {
                        x: hintedTarget.x,
                        y: (hintedTarget.feetY || 0) + BODY_HITBOX_OFFSET,
                        z: hintedTarget.z
                    },
                    dx = corePos.x - origin.x,
                    dy = corePos.y - origin.y,
                    dz = corePos.z - origin.z,
                    dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0;
                if (dist > .001 && dist <= stats.maxRange) {
                    const invDist = 1 / dist,
                        aimDot = (dx * centerDir.x + dy * centerDir.y + dz * centerDir.z) * invDist;
                    if (aimDot >= .92 && this.hasWorldLineOfSight(origin, corePos, stats.maxRange)) {
                        const hintedDamage = "head" === hintedHitType ? stats.headDamage : stats.bodyDamage,
                            hintedOut = this.applyDamage(hintedTarget, hintedDamage);
                        if (hintedOut) return void this.emitDamage(player.id, hintedTarget, hintedOut, hintedHitType)
                    }
                }
            }
        }
        if ("shotgun" === weaponId) {
            const pelletOffsets = function(cameraMode, cameraDistance) {
                return AIM_PARITY && AIM_PARITY.getShotgunPelletOffsetsNdc ? AIM_PARITY.getShotgunPelletOffsetsNdc(cameraMode, cameraDistance, AIM_VIEWPORT.width, AIM_VIEWPORT.height) : []
            }(resolveCameraMode(player.cameraMode), cameraState.cameraDistance || 0);
            for (let i = 0; i < pelletOffsets.length; i++) {
                const p = pelletOffsets[i],
                    pelletDir = this.getAimDirection(cameraState, player.yaw || 0, player.pitch || 0, p.x, p.y),
                    entityHit = this.raycastEntityHit(player, origin, pelletDir, stats.maxRange);
                if (!entityHit || !entityHit.target) continue;
                const worldBlocker = this.raycastWorldDistance(origin, pelletDir, stats.maxRange);
                if (worldBlocker !== 1 / 0 && worldBlocker < entityHit.distance - .03) continue;
                const pelletDamage = shotgunFalloffDamage("head" === entityHit.hitType ? stats.headDamage : stats.bodyDamage, entityHit.distance),
                    out = this.applyDamage(entityHit.target, pelletDamage);
                out && this.emitDamage(player.id, entityHit.target, out, entityHit.hitType)
            }
            return
        }
        const entityHit = this.raycastEntityHit(player, origin, centerDir, stats.maxRange);
        if (!entityHit || !entityHit.target) return;
        const worldBlocker = this.raycastWorldDistance(origin, centerDir, stats.maxRange);
        if (worldBlocker !== 1 / 0 && worldBlocker < entityHit.distance - .03) return;
        const damage = "head" === entityHit.hitType ? stats.headDamage : stats.bodyDamage,
            out = this.applyDamage(entityHit.target, damage);
        out && this.emitDamage(player.id, entityHit.target, out, entityHit.hitType)
    }
    handleBeamIntent(player, msg) {
        if (!player) return;
        const weaponId = String(msg.weaponId || player.beamWeaponId || player.weaponId || "");
        if (!weaponId) return;
        const active = !!msg.active;
        isContinuousWeapon(weaponId) ? (player.weaponId = weaponId, player.gripMode = inferGripMode(weaponId), player.beamWeaponId = weaponId, player.beamIntentActive = active, active || (player.beamTargetId = "", player.beamActiveUntil = 0, player.lastPlasmaTickAt = 0, resetBeamLockState(player.beamLockState, "trigger_released"))) : active || player.beamWeaponId !== weaponId || (player.beamIntentActive = !1, player.beamWeaponId = "", player.beamTargetId = "", player.beamActiveUntil = 0, player.lastPlasmaTickAt = 0, resetBeamLockState(player.beamLockState, "trigger_released"))
    }
    handleEquipWeapon(player, msg) {
        if (!player) return;
        const weaponId = String(msg.weaponId || "");
        WEAPON_STATS[weaponId] && (player.weaponId = weaponId, player.gripMode = inferGripMode(weaponId), isContinuousWeapon(weaponId) ? player.beamWeaponId = weaponId : (player.beamIntentActive = !1, player.beamWeaponId = "", player.beamTargetId = "", player.beamActiveUntil = 0, player.lastPlasmaTickAt = 0, resetBeamLockState(player.beamLockState, "trigger_released")))
    }
    spawnThrowable(player, throwableId) {
        const def = THROWABLE_DEFS[throwableId];
        if (!def) return null;
        const dir = directionFromYawPitch(player.yaw || 0, player.pitch || 0),
            id = "thr_" + this.nextThrowableId++,
            start = {
                x: player.x + .7 * dir.x,
                y: (player.feetY || 0) + ENTITY_EYE_HEIGHT + .2 * dir.y,
                z: player.z + .7 * dir.z
            },
            velocityScale = def.speed,
            throwable = {
                id: id,
                ownerId: player.id,
                type: throwableId,
                x: start.x,
                y: start.y,
                z: start.z,
                vx: dir.x * velocityScale,
                vy: dir.y * velocityScale + ("knife" === throwableId ? .6 : 3.4),
                vz: dir.z * velocityScale,
                age: 0,
                fuse: def.fuseSec,
                state: "flying"
            };
        return this.throwables.set(id, throwable), this.broadcastThrowableEvent("spawn", {
            id: id,
            type: throwableId,
            x: throwable.x,
            y: throwable.y,
            z: throwable.z
        }), throwable
    }
    handleThrowIntent(player, msg) {
        if (!player || !player.alive) return;
        const throwableId = String(msg.throwableId || ""),
            def = THROWABLE_DEFS[throwableId];
        if (!def) return;
        const now = nowMs();
        now - Number(player.lastThrowAt[throwableId] || 0) < def.cooldownMs || (player.lastThrowAt[throwableId] = now, this.spawnThrowable(player, throwableId))
    }
    handleClassQueue(player, msg, ws) {
        if (!player) return;
        const classId = String(msg.classId || "");
        CLASS_PRESETS[classId] && (player.queuedClassId = classId, this.send(ws, {
            t: "class_queued",
            classId: classId
        }))
    }
    handleChunkSubscribe(player, msg) {
        if (!player) return;
        const center = {
            cx: Math.floor(Number(msg.centerChunkX) || 0),
            cz: Math.floor(Number(msg.centerChunkZ) || 0)
        };
        this.updateChunkInterest(player, !0, center)
    }
    webSocketMessage(ws, message) {
        const msg = function(str) {
            try {
                return JSON.parse(str)
            } catch (err) {
                return null
            }
        }("string" == typeof message ? message : (new TextDecoder).decode(message));
        if (!msg || "object" != typeof msg) return;
        if (SCHEMA.validateWsClientMessage) {
            const checked = SCHEMA.validateWsClientMessage(msg);
            if (!checked.ok) return void this.send(ws, {
                t: "error",
                code: "bad_message",
                message: checked.errors[0] || "Invalid message payload"
            })
        }
        const meta = this.clients.get(ws) || ws.deserializeAttachment();
        if (!meta || !meta.userId) return;
        const player = this.players.get(meta.userId);
        if (!player) return;
        const type = String(msg.t || "");
        return "join_room" === type ? (this.sendWelcome(ws, player), void this.updateChunkInterest(player, !0)) : "input" === type ? this.handleInput(player, msg) : "fire_intent" === type ? this.handleFireIntent(player, msg) : "beam_intent" === type ? this.handleBeamIntent(player, msg) : "throw_intent" === type ? this.handleThrowIntent(player, msg) : "equip_weapon" === type ? this.handleEquipWeapon(player, msg) : "class_queue" === type ? this.handleClassQueue(player, msg, ws) : "chunk_subscribe" === type ? this.handleChunkSubscribe(player, msg) : "ping" === type ? this.send(ws, {
            t: "pong",
            clientTime: msg.clientTime || 0,
            serverTime: nowMs()
        }) : void 0
    }
    webSocketClose(ws) {
        const meta = this.clients.get(ws) || ws.deserializeAttachment();
        if (this.clients.delete(ws), meta && meta.userId) {
            const sockets = this.playerSockets.get(meta.userId);
            sockets && (sockets.delete(ws), 0 === sockets.size && this.playerSockets.delete(meta.userId))
        }
        this.stopTickIfEmpty()
    }
    regenArmor(entity, dtSec) {
        if (!entity.alive) return;
        if (entity.armor >= entity.armorMax) return;
        nowMs() - (entity.lastDamageAt || 0) < ARMOR_REGEN_DELAY_MS || (entity.armor = Math.min(entity.armorMax, entity.armor + ARMOR_REGEN_PER_SEC * dtSec))
    }
    tickContinuousBeamState(entity, dtSec) {
        if (!entity) return;
        if (!entity.alive) return entity.beamIntentActive = !1, entity.beamWeaponId = "", entity.beamTargetId = "", entity.beamActiveUntil = 0, entity.lastPlasmaTickAt = 0, void resetBeamLockState(entity.beamLockState, "invalid_target");
        const now = nowMs(),
            weaponId = String(entity.beamWeaponId || entity.weaponId || ""),
            beamCfg = getContinuousWeaponConfig(weaponId),
            stats = WEAPON_STATS[weaponId] || null;
        if (!(!!beamCfg && !!stats)) {
            entity.beamIntentActive = !1, entity.beamWeaponId = "", entity.beamTargetId = "", entity.beamActiveUntil = 0, entity.lastPlasmaTickAt = 0, resetBeamLockState(entity.beamLockState, "searching");
            const idleCoolRate = entity.beamOverheated ? .35 : .55;
            return entity.beamHeat = Math.max(0, (entity.beamHeat || 0) - idleCoolRate * dtSec), void(entity.beamOverheated && now >= (entity.beamOverheatedUntil || 0) && entity.beamHeat <= .95 && (entity.beamOverheated = !1, entity.beamOverheatedUntil = 0))
        }
        const currentlyOverheated = !!entity.beamOverheated && now < (entity.beamOverheatedUntil || 0);
        if (!entity.beamIntentActive && !entity.beamTargetId) {
            resetBeamLockState(entity.beamLockState, currentlyOverheated ? "overheated" : "trigger_released"), entity.lastPlasmaTickAt = 0;
            const coolRate = entity.beamOverheated ? .35 : .55;
            return entity.beamHeat = Math.max(0, (entity.beamHeat || 0) - coolRate * dtSec), void(entity.beamOverheated && now >= (entity.beamOverheatedUntil || 0) && entity.beamHeat <= .95 && (entity.beamOverheated = !1, entity.beamOverheatedUntil = 0))
        }
        const lockState = this.resolveBeamLock(entity, weaponId, stats.maxRange, currentlyOverheated),
            lockedTarget = lockState && lockState.target ? lockState.target : null,
            activeLock = !!lockedTarget && "locked" === lockState.reason && !currentlyOverheated;
        activeLock ? (entity.beamTargetId = lockedTarget.id, entity.beamActiveUntil = now + REMOTE_BEAM_HOLD_MS) : (entity.beamTargetId = "", entity.beamActiveUntil = 0, entity.lastPlasmaTickAt = 0);
        const effectId = String(beamCfg.effect || "");
        if (activeLock && "plasma_tick" === effectId)
            for (((entity.lastPlasmaTickAt || 0) <= 0 || entity.lastPlasmaTickAt > now) && (entity.lastPlasmaTickAt = now - PLASMA_TICK_MS); now - entity.lastPlasmaTickAt >= PLASMA_TICK_MS && !entity.beamOverheated;) {
                entity.lastPlasmaTickAt += PLASMA_TICK_MS;
                const out = this.applyDamage(lockedTarget, stats.bodyDamage);
                out && this.emitDamage(entity.id, lockedTarget, out, "body"), entity.beamHeat = clamp((entity.beamHeat || 0) + PLASMA_TICK_MS / PLASMA_MAX_SUSTAIN_MS, 0, 1), entity.beamHeat >= 1 && (entity.beamHeat = 1, entity.beamOverheated = !0, entity.beamOverheatedUntil = now + PLASMA_OVERHEAT_MS, entity.beamTargetId = "", entity.beamActiveUntil = 0, entity.lastPlasmaTickAt = 0, resetBeamLockState(entity.beamLockState, "overheated"))
            } else {
                const coolRate = entity.beamOverheated ? .35 : .55;
                entity.beamHeat = Math.max(0, (entity.beamHeat || 0) - coolRate * dtSec)
            } entity.beamOverheated && now >= (entity.beamOverheatedUntil || 0) && entity.beamHeat <= .95 && (entity.beamOverheated = !1, entity.beamOverheatedUntil = 0)
    }
    applyQueuedClassIfNeeded(entity) {
        if (!entity.queuedClassId) return;
        entity.classId = entity.queuedClassId, entity.queuedClassId = null;
        const preset = classPreset(entity.classId);
        entity.armorMax = preset.armorMax, entity.armor = preset.armorMax, entity.wallhackRadius = preset.wallhackRadius
    }
    respawnIfNeeded(entity) {
        if (entity.alive) return;
        if ((entity.respawnAt || 0) > nowMs()) return;
        this.applyQueuedClassIfNeeded(entity), entity.hp = entity.hpMax, entity.armor = entity.armorMax, entity.alive = !0, entity.respawnAt = 0, entity.lastDamageAt = 0;
        const spawn = this.pickSafeSpawn({
            padding: 8,
            tries: 120,
            feetY: 0,
            height: ENTITY_HEIGHT,
            radius: ENTITY_RADIUS
        });
        entity.x = spawn.x, entity.z = spawn.z, entity.feetY = 0, entity.velY = 0, entity.grounded = !0, entity.jumpHeldPrev = !1, entity.jumpHoldTimerSec = 0, entity.beamIntentActive = !1, entity.beamWeaponId = "", entity.beamTargetId = "", entity.beamActiveUntil = 0, entity.beamHeat = 0, entity.beamOverheated = !1, entity.beamOverheatedUntil = 0, entity.lastPlasmaTickAt = 0, resetBeamLockState(entity.beamLockState, "searching"), entity.animState = "idle", entity.animPhase = "number" == typeof entity.animPhase ? entity.animPhase : 0, entity.gripMode = inferGripMode(entity.weaponId || "rifle"), entity.aimPitch = 0, "player" === entity.kind && this.updateChunkInterest(entity, !0)
    }
    tickBots(dtSec) {
        const players = Array.from(this.players.values()).filter(p => p.alive);
        for (const bot of this.bots.values())
            if (this.respawnIfNeeded(bot), bot.alive) {
                if (bot.aiTurnTimer -= dtSec, bot.aiTurnTimer <= 0) {
                    bot.aiTurnTimer = 1 + 3 * Math.random();
                    const angle = Math.random() * Math.PI * 2;
                    bot.aiDirX = Math.cos(angle), bot.aiDirZ = Math.sin(angle), bot.aiSpeed = 1.8 + 1.2 * Math.random()
                }
                if (players.length > 0 && Math.random() < .015) {
                    const target = players[Math.floor(Math.random() * players.length)],
                        dx = target.x - bot.x,
                        dz = target.z - bot.z,
                        len = Math.sqrt(dx * dx + dz * dz) || 1;
                    bot.aiDirX = dx / len, bot.aiDirZ = dz / len
                }
                this.moveEntityHorizontalWithCollision(bot, bot.x + bot.aiDirX * bot.aiSpeed * dtSec, bot.z + bot.aiDirZ * bot.aiSpeed * dtSec, bot.feetY), bot.yaw = Math.atan2(bot.aiDirX, bot.aiDirZ), bot.pitch = 0, bot.aimPitch = 0, bot.moveSpeedNorm = clamp(bot.aiSpeed / 3.2, 0, 1.4), bot.sprinting = bot.aiSpeed > 2.5, bot.animState = bot.sprinting ? "sprint" : bot.moveSpeedNorm > .45 ? "run" : "walk", bot.animPhase = ("number" == typeof bot.animPhase ? bot.animPhase : 0) + dtSec * (7 + 6 * bot.moveSpeedNorm), bot.gripMode = inferGripMode(bot.weaponId || "rifle"), bot.feetY = 0, bot.grounded = !0, bot.velY = 0, this.regenArmor(bot, dtSec), this.tickContinuousBeamState(bot, dtSec)
            }
    }
    tickPlayers(dtSec) {
        for (const player of this.players.values())
            if (this.respawnIfNeeded(player), player.alive) {
                if (this.simulatePlayerMovement(player, dtSec), "number" == typeof player.animPhase && Number.isFinite(player.animPhase)) {
                    if (player.moveSpeedNorm > .02) {
                        const baseFreq = player.sprinting ? 14 : player.moveSpeedNorm > .45 ? 11 : 8.2;
                        player.animPhase += dtSec * (baseFreq * (.32 + player.moveSpeedNorm))
                    }
                } else player.animPhase = 0;
                this.regenArmor(player, dtSec), this.tickContinuousBeamState(player, dtSec), this.updateChunkInterest(player, !1)
            }
    }
    findNearestTargetForSeeker(ownerId, x, y, z, maxRange) {
        let best = null;
        return this.eachCombatEntity(entity => {
            if (!entity || !entity.alive || entity.id === ownerId) return;
            const tx = entity.x - x,
                ty = (entity.feetY || 0) + BODY_HITBOX_OFFSET - y,
                tz = entity.z - z,
                dist = Math.sqrt(tx * tx + ty * ty + tz * tz);
            !isFinite(dist) || dist <= .001 || dist > maxRange || (!best || dist < best.dist) && (best = {
                entity: entity,
                dist: dist,
                dir: {
                    x: tx / dist,
                    y: ty / dist,
                    z: tz / dist
                }
            })
        }), best
    }
    findThrowableEntityHit(ownerId, x, y, z, radius) {
        let best = null;
        return this.eachCombatEntity(entity => {
            if (!entity || !entity.alive || entity.id === ownerId) return;
            const body = makeEntityBodyAabb(entity),
                head = makeEntityHeadAabb(entity),
                bodyHit = sphereIntersectsAabb(x, y, z, radius, body),
                headHit = sphereIntersectsAabb(x, y, z, radius, head);
            if (!bodyHit && !headHit) return;
            const dx = entity.x - x,
                dy = (entity.feetY || 0) + BODY_HITBOX_OFFSET - y,
                dz = entity.z - z,
                dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            (!best || dist < best.distance) && (best = {
                entity: entity,
                hitType: headHit ? "head" : "body",
                distance: dist
            })
        }), best
    }
    explodeThrowable(throwable, def) {
        if (!throwable || !def) return;
        this.broadcastThrowableEvent("explode", {
            id: throwable.id,
            type: throwable.type,
            x: throwable.x,
            y: throwable.y,
            z: throwable.z,
            radius: Number(def.radius || 0),
            ttlMs: 220
        }), "molotov" === throwable.type && (this.molotovZones.set(`mz_${throwable.id}`, {
            id: `mz_${throwable.id}`,
            ownerId: throwable.ownerId,
            x: throwable.x,
            z: throwable.z,
            radius: def.radius,
            lifeLeft: def.zoneDuration,
            tickTimer: 0
        }), this.broadcastThrowableEvent("zone_create", {
            id: `mz_${throwable.id}`,
            type: "molotov",
            x: throwable.x,
            y: 0,
            z: throwable.z,
            radius: Number(def.radius || 0),
            ttlMs: Math.max(0, Math.floor(1e3 * Number(def.zoneDuration || 0)))
        }));
        const radius = Number(def.radius || 0),
            baseDamage = Number(def.damage || 0);
        radius <= 0 || baseDamage <= 0 || this.eachCombatEntity(target => {
            if (!target || !target.alive) return;
            const coreY = (target.feetY || 0) + BODY_HITBOX_OFFSET,
                dx = target.x - throwable.x,
                dy = coreY - throwable.y,
                dz = target.z - throwable.z,
                dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > radius) return;
            const scale = 1 - dist / radius,
                damage = Math.max(1, Math.round(baseDamage * scale)),
                out = this.applyDamage(target, damage);
            out && this.emitDamage(throwable.ownerId, target, out, "body")
        })
    }
    tickThrowables(dtSec) {
        if (0 === this.throwables.size && 0 === this.molotovZones.size) return;
        const toDelete = [];
        for (const throwable of this.throwables.values()) {
            const def = THROWABLE_DEFS[throwable.type];
            if (!def) {
                toDelete.push(throwable.id);
                continue
            }
            if (throwable.age += dtSec, "seeker" === throwable.type) {
                const seek = this.findNearestTargetForSeeker(throwable.ownerId, throwable.x, throwable.y, throwable.z, 28);
                if (seek) {
                    const seekAmt = Math.min(1, def.seekStrength * dtSec),
                        speed = Math.sqrt(throwable.vx * throwable.vx + throwable.vy * throwable.vy + throwable.vz * throwable.vz) || def.speed;
                    throwable.vx = throwable.vx * (1 - seekAmt) + seek.dir.x * speed * seekAmt, throwable.vy = throwable.vy * (1 - seekAmt) + seek.dir.y * speed * seekAmt, throwable.vz = throwable.vz * (1 - seekAmt) + seek.dir.z * speed * seekAmt
                }
            }
            throwable.vy -= Number(def.gravity || 0) * dtSec;
            const nextX = throwable.x + throwable.vx * dtSec,
                nextY = throwable.y + throwable.vy * dtSec,
                nextZ = throwable.z + throwable.vz * dtSec,
                sphereRadius = .16 * Number(def.radius || .5);
            let hitWorld = !1;
            for (let i = 0; i < this.worldColliders.length; i++)
                if (sphereIntersectsAabb(nextX, nextY, nextZ, sphereRadius, this.worldColliders[i])) {
                    hitWorld = !0;
                    break
                } const hitEntity = this.findThrowableEntityHit(throwable.ownerId, nextX, nextY, nextZ, sphereRadius);
            if (throwable.x = nextX, throwable.y = nextY, throwable.z = nextZ, "knife" === throwable.type && hitEntity && hitEntity.entity) {
                const damage = "head" === hitEntity.hitType ? THROWABLE_DEFS.knife.damageHead : THROWABLE_DEFS.knife.damageBody,
                    out = this.applyDamage(hitEntity.entity, damage);
                out && this.emitDamage(throwable.ownerId, hitEntity.entity, out, hitEntity.hitType), toDelete.push(throwable.id);
                continue
            }(nextY <= 0 || hitWorld || throwable.age >= Number(def.fuse || 0)) && ("knife" !== throwable.type && this.explodeThrowable(throwable, def), toDelete.push(throwable.id))
        }
        for (let i = 0; i < toDelete.length; i++) this.throwables.delete(toDelete[i]);
        const zonesToDelete = [];
        for (const zone of this.molotovZones.values())
            if (zone.lifeLeft -= dtSec, zone.lifeLeft <= 0) this.broadcastThrowableEvent("zone_end", {
                id: zone.id,
                type: "molotov",
                x: zone.x,
                y: 0,
                z: zone.z,
                radius: zone.radius
            }), zonesToDelete.push(zone.id);
            else
                for (zone.tickTimer -= dtSec; zone.tickTimer <= 0;) zone.tickTimer += Number(THROWABLE_DEFS.molotov.zoneTickRate || .25), this.eachCombatEntity(target => {
                    if (!target || !target.alive) return;
                    const dx = target.x - zone.x,
                        dz = target.z - zone.z;
                    if (Math.sqrt(dx * dx + dz * dz) > zone.radius) return;
                    const out = this.applyDamage(target, Number(THROWABLE_DEFS.molotov.zoneTickDamage || 16));
                    out && this.emitDamage(zone.ownerId, target, out, "body")
                });
        for (let i = 0; i < zonesToDelete.length; i++) this.molotovZones.delete(zonesToDelete[i])
    }
    toEntityState(entity) {
        return {
            id: entity.id,
            kind: entity.kind,
            username: entity.username,
            classId: entity.classId,
            queuedClassId: entity.queuedClassId || null,
            x: Number(entity.x.toFixed(3)),
            feetY: Number((entity.feetY || 0).toFixed(3)),
            z: Number(entity.z.toFixed(3)),
            yaw: Number((entity.yaw || 0).toFixed(4)),
            pitch: Number((entity.pitch || 0).toFixed(4)),
            shoulderSide: "left" === entity.shoulderSide ? "left" : "right",
            velY: Number((entity.velY || 0).toFixed(4)),
            grounded: !!entity.grounded,
            weaponId: entity.weaponId || "rifle",
            moveSpeedNorm: Number((entity.moveSpeedNorm || 0).toFixed(3)),
            sprinting: !!entity.sprinting,
            animState: VALID_ANIM_STATES.has(entity.animState) ? entity.animState : "idle",
            animPhase: Number((entity.animPhase || 0).toFixed(4)),
            gripMode: VALID_GRIP_MODES.has(entity.gripMode) ? entity.gripMode : inferGripMode(entity.weaponId || "rifle"),
            aimPitch: Number((("number" == typeof entity.aimPitch ? entity.aimPitch : entity.pitch) || 0).toFixed(4)),
            hp: Number(entity.hp.toFixed(2)),
            hpMax: Number(entity.hpMax.toFixed(2)),
            armor: Number(entity.armor.toFixed(2)),
            armorMax: Number(entity.armorMax.toFixed(2)),
            wallhackRadius: entity.wallhackRadius,
            alive: !!entity.alive,
            beamTargetId: entity.beamTargetId || "",
            beamActiveUntil: entity.beamActiveUntil || 0,
            beamHeat: Number((entity.beamHeat || 0).toFixed(3)),
            beamOverheated: !!entity.beamOverheated,
            visibleWallhack: !0
        }
    }
    toThrowableState(throwable) {
        const def = THROWABLE_DEFS[throwable.type] || {};
        return {
            id: throwable.id,
            ownerId: throwable.ownerId || "",
            type: throwable.type,
            x: Number((throwable.x || 0).toFixed(3)),
            y: Number((throwable.y || 0).toFixed(3)),
            z: Number((throwable.z || 0).toFixed(3)),
            vx: Number((throwable.vx || 0).toFixed(3)),
            vy: Number((throwable.vy || 0).toFixed(3)),
            vz: Number((throwable.vz || 0).toFixed(3)),
            fuse: Number(Math.max(0, Number(def.fuseSec || 0) - Number(throwable.age || 0)).toFixed(3)),
            state: "flying"
        }
    }
    toZoneState(zone) {
        return {
            id: zone.id,
            type: "molotov",
            x: Number((zone.x || 0).toFixed(3)),
            z: Number((zone.z || 0).toFixed(3)),
            radius: Number((zone.radius || 0).toFixed(3)),
            lifeLeft: Number((zone.lifeLeft || 0).toFixed(3))
        }
    }
    broadcastThrowableEvent(eventType, payload = {}) {
        const packet = {
            t: "throwable_event",
            eventType: String(eventType || ""),
            id: String(payload.id || ""),
            type: void 0 !== payload.type ? String(payload.type) : void 0,
            x: "number" == typeof payload.x && Number.isFinite(payload.x) ? Number(payload.x.toFixed(3)) : void 0,
            y: "number" == typeof payload.y && Number.isFinite(payload.y) ? Number(payload.y.toFixed(3)) : void 0,
            z: "number" == typeof payload.z && Number.isFinite(payload.z) ? Number(payload.z.toFixed(3)) : void 0,
            radius: "number" == typeof payload.radius && Number.isFinite(payload.radius) ? Number(payload.radius.toFixed(3)) : void 0,
            ttlMs: "number" == typeof payload.ttlMs && Number.isFinite(payload.ttlMs) ? Math.max(0, Math.floor(payload.ttlMs)) : void 0
        };
        if (SCHEMA.validateThrowableEvent) {
            const checked = SCHEMA.validateThrowableEvent(packet);
            if (!checked.ok) return;
            return void this.broadcast(checked.value)
        }
        this.broadcast(packet)
    }
    broadcastThrowableSnapshot(force) {
        const throwables = [],
            zones = [];
        for (const throwable of this.throwables.values()) throwables.push(this.toThrowableState(throwable));
        for (const zone of this.molotovZones.values()) zones.push(this.toZoneState(zone));
        const hasActive = throwables.length > 0 || zones.length > 0;
        if (!force && !hasActive && !this.hadThrowablesLastTick) return;
        this.hadThrowablesLastTick = hasActive;
        const packet = {
            t: "throwable_snapshot",
            serverTime: nowMs(),
            throwables: throwables,
            zones: zones
        };
        if (SCHEMA.validateThrowableSnapshot) {
            const checked = SCHEMA.validateThrowableSnapshot(packet);
            if (!checked.ok) return;
            return void this.broadcast(checked.value)
        }
        this.broadcast(packet)
    }
    broadcastEntitySnapshot() {
        const entities = [];
        for (const player of this.players.values()) entities.push(this.toEntityState(player));
        for (const bot of this.bots.values()) entities.push(this.toEntityState(bot));
        const packet = {
            t: "entity_snapshot",
            serverTime: nowMs(),
            entities: entities
        };
        if (SCHEMA.validateServerEntitySnapshot) {
            const checked = SCHEMA.validateServerEntitySnapshot(packet);
            return checked.ok ? void this.broadcast(checked.value) : void console.warn("entity_snapshot validation failed:", checked.errors[0])
        }
        this.broadcast(packet)
    }
    sendReconcile(player) {
        if (!player) return;
        const sockets = this.playerSockets.get(player.id);
        if (!sockets || 0 === sockets.size) return;
        const reconcile = {
            t: "server_reconcile",
            seq: Number(player.seq || 0),
            x: Number(player.x.toFixed(3)),
            feetY: Number((player.feetY || 0).toFixed(3)),
            z: Number(player.z.toFixed(3)),
            yaw: Number((player.yaw || 0).toFixed(4)),
            pitch: Number((player.pitch || 0).toFixed(4)),
            velY: Number((player.velY || 0).toFixed(4)),
            grounded: !!player.grounded
        };
        if (SCHEMA.validateServerReconcile) {
            if (!SCHEMA.validateServerReconcile(reconcile).ok) return
        }
        for (const ws of sockets.values()) this.send(ws, reconcile)
    }
    tick() {
        const now = nowMs(),
            dtSec = Math.max(.001, Math.min(.2, (now - this.lastTickAt) / 1e3));
        this.lastTickAt = now, this.ensureBots(), this.tickPlayers(dtSec), this.tickBots(dtSec), this.tickThrowables(dtSec), this.broadcastEntitySnapshot(), this.broadcastThrowableSnapshot(!1);
        for (const player of this.players.values()) this.sendReconcile(player)
    }
}
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if ("POST" === request.method && "/api/auth/login" === url.pathname) return handleLogin(env, request);
        if ("POST" === request.method && "/api/auth/logout" === url.pathname) return async function(env, request) {
            const cookieName = env.SESSION_COOKIE_NAME || "mfa_session",
                sid = parseCookies(request.headers.get("Cookie"))[cookieName];
            return sid && await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(sid).run(), json({
                ok: !0
            }, 200, {
                "Set-Cookie": `${cookieName}=; HttpOnly;${"https:"===new URL(request.url).protocol?" Secure;":""} SameSite=Lax; Path=/; Max-Age=0`
            })
        }(env, request);
        if ("GET" === request.method && "/api/me" === url.pathname) return async function(env, request) {
            const session = await getSessionFromRequest(env, request);
            return session ? json({
                ok: !0,
                user: {
                    id: session.userId,
                    username: session.username,
                    classId: session.classId,
                    kills: session.kills,
                    deaths: session.deaths,
                    damageDone: session.damageDone,
                    damageTaken: session.damageTaken
                },
                sessionExpiresAt: new Date(1e3 * session.expiresAt).toISOString()
            }) : json({
                ok: !1,
                error: "Unauthorized"
            }, 401)
        }(env, request);
        if ("GET" === request.method && "/api/world/bootstrap" === url.pathname) {
            const bootstrap = WORLD_LAYOUT && WORLD_LAYOUT.getBootstrapPayload ? WORLD_LAYOUT.getBootstrapPayload(WORLD_CONFIG, WORLD_CHUNK_INDEX) : {
                worldId: "global-world",
                protocolVersion: 2,
                chunkSize: WORLD_CHUNK_SIZE,
                interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS,
                tickRate: NETWORK_TICK_RATE_HZ,
                seed: String(env.WORLD_SEED || WORLD_SEED),
                spawnRules: {
                    feetY: 0,
                    padding: 8
                },
                initialChunks: []
            };
            return json({
                ok: !0,
                worldId: bootstrap.worldId,
                protocolVersion: bootstrap.protocolVersion,
                chunkSize: bootstrap.chunkSize,
                interestRadiusChunks: bootstrap.interestRadiusChunks,
                tickRate: bootstrap.tickRate,
                seed: bootstrap.seed,
                spawnRules: bootstrap.spawnRules,
                initialChunks: bootstrap.initialChunks,
                world: {
                    version: 2,
                    seed: String(env.WORLD_SEED || WORLD_SEED),
                    size: WORLD_SIZE,
                    center: WORLD_CENTER,
                    margin: WORLD_MARGIN,
                    min: WORLD_MIN,
                    max: WORLD_MAX,
                    areaScale: WORLD_AREA_SCALE,
                    chunkStreaming: !0,
                    chunkSize: WORLD_CHUNK_SIZE,
                    interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS,
                    solidBoxes: [],
                    initialChunks: bootstrap.initialChunks
                }
            })
        }
        if ("GET" === request.method && "/api/world" === url.pathname) return json({
            ok: !0,
            world: {
                version: 2,
                seed: String(env.WORLD_SEED || WORLD_SEED),
                size: WORLD_SIZE,
                center: WORLD_CENTER,
                margin: WORLD_MARGIN,
                min: WORLD_MIN,
                max: WORLD_MAX,
                areaScale: WORLD_AREA_SCALE,
                chunkSize: WORLD_CHUNK_SIZE,
                interestRadiusChunks: WORLD_INTEREST_RADIUS_CHUNKS,
                chunkCount: WORLD_CHUNK_INDEX.size,
                solidBoxes: SERVER_WORLD_SOLIDS
            }
        });
        if ("/api/ws" === url.pathname) return async function(env, request) {
            const session = await getSessionFromRequest(env, request);
            if (!session) return new Response("Unauthorized", {
                status: 401
            });
            const id = env.GLOBAL_ARENA.idFromName(env.ROOM_NAME || "global"),
                stub = env.GLOBAL_ARENA.get(id),
                doUrl = new URL("https://room/connect");
            doUrl.searchParams.set("userId", session.userId), doUrl.searchParams.set("username", session.username), doUrl.searchParams.set("classId", session.classId || "sharpshooter");
            const headers = new Headers(request.headers);
            return headers.set("X-User-Id", session.userId), stub.fetch(new Request(doUrl.toString(), {
                method: request.method,
                headers: headers,
                body: request.body
            }))
        }(env, request);
        const staticResponse = await maybeServeStaticAsset(env, request, url);
        if (staticResponse) return staticResponse;
        return new Response("Not Found", {
            status: 404
        })
    }
};

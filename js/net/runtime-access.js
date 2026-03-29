/**
 * runtime-access.js - Narrow runtime-global access for GameNet.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetRuntimeAccess
 */
(function () {
    'use strict';

    function create(opts) {
        opts = opts || {};
        var explicitRuntime = opts.runtime && typeof opts.runtime === 'object'
            ? opts.runtime
            : null;
        var fireOriginScratch = (typeof THREE !== 'undefined' && THREE && THREE.Vector3)
            ? new THREE.Vector3()
            : null;

        function runtime() {
            return explicitRuntime || globalThis.__MAYHEM_RUNTIME || {};
        }

        function shared() {
            return runtime().GameShared || {};
        }

        function runtimeProfile() {
            return runtime().GameRuntimeProfile || null;
        }

        function getPlayerApi() {
            return runtime().GamePlayer || null;
        }

        function getWorldApi() {
            return runtime().GameWorld || null;
        }

        function getAbilityFxApi() {
            return runtime().GameAbilityFx || null;
        }

        function getPlayerCombatApi() {
            return runtime().GamePlayerCombat || null;
        }

        function getTransportApi() {
            return runtime().GameNetTransport || null;
        }

        function getRemoteSyncApi() {
            return runtime().GameNetRemoteSync || null;
        }

        function getNetApi() {
            return runtime().GameNet || null;
        }

        function getHitscanApi() {
            return runtime().GameHitscan || null;
        }

        function getSocketIdentity(authApi) {
            if (authApi && authApi.getSocketIdentity) return authApi.getSocketIdentity();
            return authApi && authApi.getUser ? authApi.getUser() : null;
        }

        function getCurrentUser(authApi) {
            return getSocketIdentity(authApi);
        }

        function buildWsEndpoint(opts) {
            opts = opts || {};
            var profile = runtimeProfile();
            var endpoint = (profile && profile.resolveWsUrl)
                ? profile.resolveWsUrl(opts.wsPath)
                : ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + opts.wsPath);
            var authApi = opts.authApi || null;
            var params = new URLSearchParams();
            params.set('room', String(opts.roomId || 'global'));
            if (authApi && authApi.getSocketPlayerId) {
                params.set('pid', String(authApi.getSocketPlayerId() || ''));
            }
            var actor = authApi && authApi.getPartyIdentity ? authApi.getPartyIdentity() : null;
            if (actor && actor.id) {
                params.set('actorId', String(actor.id));
                params.set('actorName', String(actor.username || actor.id));
            }
            var user = getSocketIdentity(authApi);
            if (user && user.id) {
                params.set('uid', String(user.id));
                params.set('username', String(user.username || user.id));
                params.set('classId', String(user.classId || 'abilities'));
            }
            return endpoint + '?' + params.toString();
        }

        function buildFirePayload(msgType, weaponId, shotToken) {
            if (!weaponId) return null;
            var payload = {
                t: msgType,
                weaponId: String(weaponId)
            };
            var hitscanApi = getHitscanApi();
            var fireIntent = hitscanApi && hitscanApi.buildNetworkFireIntent
                ? hitscanApi.buildNetworkFireIntent(shotToken)
                : null;
            if (fireIntent && String(fireIntent.weaponId || '') === String(weaponId)) {
                if (fireIntent.adsActive) payload.adsActive = true;
                if (isFinite(Number(fireIntent.viewFovDeg)) && Number(fireIntent.viewFovDeg) > 0.0001) {
                    payload.viewFovDeg = Number(fireIntent.viewFovDeg);
                }
                if (fireIntent.aimOrigin) {
                    payload.aimOrigin = {
                        x: Number(fireIntent.aimOrigin.x || 0),
                        y: Number(fireIntent.aimOrigin.y || 0),
                        z: Number(fireIntent.aimOrigin.z || 0)
                    };
                }
                if (fireIntent.aimForward) {
                    payload.aimForward = {
                        x: Number(fireIntent.aimForward.x || 0),
                        y: Number(fireIntent.aimForward.y || 0),
                        z: Number(fireIntent.aimForward.z || 0)
                    };
                }
            }
            var playerApi = getPlayerApi();
            if (!payload.adsActive && playerApi && playerApi.getAdsState) {
                var adsState = playerApi.getAdsState();
                if (adsState && adsState.active) payload.adsActive = true;
            }
            if (!payload.viewFovDeg && playerApi && playerApi.getCamera) {
                var camera = playerApi.getCamera();
                var cameraFov = Number(camera && camera.fov);
                if (isFinite(cameraFov) && cameraFov > 0.0001) payload.viewFovDeg = cameraFov;
            }
            if (!payload.aimForward && playerApi && playerApi.getRotation) {
                var rot = playerApi.getRotation();
                var yaw = Number(rot && rot.yaw || 0);
                var pitch = Number(rot && rot.pitch || 0);
                var x = -Math.sin(yaw) * Math.cos(pitch);
                var y = Math.sin(-pitch);
                var z = -Math.cos(yaw) * Math.cos(pitch);
                var len = Math.sqrt((x * x) + (y * y) + (z * z)) || 1;
                if (isFinite(len) && len > 0.000001) {
                    payload.aimForward = {
                        x: x / len,
                        y: y / len,
                        z: z / len
                    };
                }
            }
            if (!payload.aimOrigin) {
                var fireOrigin = null;
                if (playerApi && playerApi.getEyeWorldPosition) {
                    fireOrigin = fireOriginScratch
                        ? playerApi.getEyeWorldPosition(fireOriginScratch)
                        : playerApi.getEyeWorldPosition();
                }
                if ((!fireOrigin || !isFinite(Number(fireOrigin.x)) || !isFinite(Number(fireOrigin.y)) || !isFinite(Number(fireOrigin.z))) && playerApi && playerApi.getCamera) {
                    var fireCamera = playerApi.getCamera();
                    if (fireCamera && fireCamera.position) {
                        fireOrigin = fireCamera.position;
                    }
                }
                if (fireOrigin && isFinite(Number(fireOrigin.x)) && isFinite(Number(fireOrigin.y)) && isFinite(Number(fireOrigin.z))) {
                    var eyeOrigin = {
                        x: Number(fireOrigin.x || 0),
                        y: Number(fireOrigin.y || 0),
                        z: Number(fireOrigin.z || 0)
                    };
                    var sharedPoints = shared().entityPoints || {};
                    payload.aimOrigin = sharedPoints.logicalHitscanOriginFromEye && payload.aimForward
                        ? sharedPoints.logicalHitscanOriginFromEye(eyeOrigin, payload.aimForward)
                        : eyeOrigin;
                }
            }
            var netApi = getNetApi();
            if (netApi && netApi.getEstimatedServerTime) {
                var estimatedServerTime = Number(netApi.getEstimatedServerTime() || 0);
                if (isFinite(estimatedServerTime) && estimatedServerTime > 0) {
                    payload.estimatedServerShotTime = Math.round(estimatedServerTime);
                }
            }
            if (shotToken) payload.shotToken = String(shotToken);
            return payload;
        }

        function getActiveWorldMeta() {
            var worldApi = getWorldApi();
            return worldApi && worldApi.getWorldMeta ? worldApi.getWorldMeta() : null;
        }

        function damagePointY(entityY) {
            var points = shared().entityPoints || {};
            return points.entityDamagePointY ? points.entityDamagePointY(entityY) : (entityY + 1.06);
        }

        function markerPointY(entityY) {
            var points = shared().entityPoints || {};
            return points.entityMarkerPointY ? points.entityMarkerPointY(entityY) : (entityY + 2.25);
        }

        return {
            runtimeProfile: runtimeProfile,
            getPlayerApi: getPlayerApi,
            getAbilityFxApi: getAbilityFxApi,
            getPlayerCombatApi: getPlayerCombatApi,
            getTransportApi: getTransportApi,
            getRemoteSyncApi: getRemoteSyncApi,
            getSocketIdentity: getSocketIdentity,
            getCurrentUser: getCurrentUser,
            buildWsEndpoint: buildWsEndpoint,
            buildFirePayload: buildFirePayload,
            getActiveWorldMeta: getActiveWorldMeta,
            damagePointY: damagePointY,
            markerPointY: markerPointY
        };
    }

    globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    globalThis.__MAYHEM_RUNTIME.GameNetRuntimeAccess = {
        create: create
    };
})();

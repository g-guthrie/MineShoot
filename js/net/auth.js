/**
 * net/auth.js - Authentication module extracted from network.js
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetAuth
 */
(function () {
    'use strict';

    var GameNetAuth = {};

    var PROTOCOL = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol) ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol : null;
    var AUTH_PATH = (PROTOCOL && PROTOCOL.authPath) ? PROTOCOL.authPath : {};
    var PROFILE_PATH = (PROTOCOL && PROTOCOL.profilePath) ? PROTOCOL.profilePath : {};

    var AUTH_COOKIE_HELP = 'Any unique username + 4-digit PIN';

    var user = null;
    var guestMode = false;
    var ownProfile = null;
    var publicSessionUser = null;
    var menuGuestUser = null;
    var uiBound = false;
    var sessionFetchPromise = null;
    var socketPlayerId = '';
    var SOCKET_PLAYER_ID_KEY = 'mayhem.arena.playerId';
    var PUBLIC_SESSION_USER_KEY = 'mayhem.arena.publicUser';
    var runtimeTabToken = '';
    var arenaIdentityReadyPromise = null;
    var identityChannel = null;
    var authUi = null;

    function randomToken(prefix) {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
            return String(prefix || '') + globalThis.crypto.randomUUID().replace(/-/g, '');
        }
        return String(prefix || '') + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function emitAuthChanged() {
        if (window && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('mayhem-auth-changed'));
        }
    }

    function runtimeProfile() {
        return globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile || null;
    }

    function selectedMode() {
        var runtime = runtimeProfile();
        return (runtime && runtime.getSelectedMode) ? runtime.getSelectedMode() : null;
    }

    function authMode() {
        var mode = selectedMode();
        return (mode && mode.authMode) ? mode.authMode : 'public';
    }

    function sessionStore() {
        try {
            return window.sessionStorage || null;
        } catch (_err) {
            return null;
        }
    }

    function resolveApiUrl(path) {
        var runtime = runtimeProfile();
        if (runtime && runtime.resolveApiUrl) return runtime.resolveApiUrl(path);
        return path;
    }

    function sessionMeUrl() {
        return resolveApiUrl(AUTH_PATH.me || '/api/me');
    }

    function sessionLoginUrl() {
        return resolveApiUrl(AUTH_PATH.login || '/api/auth/login');
    }

    function sessionLogoutUrl() {
        return resolveApiUrl(AUTH_PATH.logout || '/api/auth/logout');
    }

    function profileMeUrl() {
        return resolveApiUrl(PROFILE_PATH.me || '/api/profile/me');
    }

    function apiFetch(url, options) {
        options = options || {};
        var cfg = {
            method: options.method || 'GET',
            headers: options.headers || {},
            credentials: 'include'
        };
        if (options.body !== undefined) {
            cfg.body = options.body;
        }
        return fetch(resolveApiUrl(url), cfg);
    }

    function parseApiBody(text) {
        var raw = String(text || '').trim();
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (_err) {
            return null;
        }
    }

    function readApiResponse(response) {
        if (!response || typeof response.text !== 'function') {
            return Promise.resolve({
                status: 0,
                body: null,
                rawText: '',
                response: response || null
            });
        }

        return response.text()
            .catch(function () {
                return '';
            })
            .then(function (text) {
                return {
                    status: response.status,
                    body: parseApiBody(text),
                    rawText: String(text || ''),
                    response: response
                };
            });
    }

    function apiErrorMessage(res, fallback) {
        if (res && res.body && typeof res.body.error === 'string' && res.body.error.trim()) {
            return res.body.error.trim();
        }

        if (res && typeof res.rawText === 'string') {
            var raw = res.rawText.trim();
            if (raw && raw.charAt(0) !== '<') {
                return raw;
            }
        }

        return fallback;
    }

    function makeSocketPlayerId() {
        return randomToken('ply_').slice(0, 28);
    }

    function getSocketPlayerId() {
        var store;
        if (!socketPlayerId) {
            store = sessionStore();
            if (store) {
                socketPlayerId = String(store.getItem(SOCKET_PLAYER_ID_KEY) || '').trim();
            }
            if (!socketPlayerId) {
                socketPlayerId = makeSocketPlayerId();
                if (store) {
                    try {
                        store.setItem(SOCKET_PLAYER_ID_KEY, socketPlayerId);
                    } catch (_err) {
                        // no-op
                    }
                }
            }
        }
        return socketPlayerId;
    }

    function makePublicSessionUser() {
        var numericId = Math.floor(100000 + (Math.random() * 900000));
        return {
            id: getSocketPlayerId(),
            username: 'PLAYER ' + String(numericId),
            classId: 'abilities'
        };
    }

    function makeMenuGuestUser() {
        var numericId = Math.floor(100000 + (Math.random() * 900000));
        return {
            id: 'gst_' + randomToken('').slice(0, 8).toLowerCase(),
            username: 'PLAYER ' + String(numericId),
            classId: 'abilities'
        };
    }

    function writePublicSessionUser(nextUser) {
        var store = sessionStore();
        publicSessionUser = nextUser || makePublicSessionUser();
        publicSessionUser.id = getSocketPlayerId();
        publicSessionUser.username = String(publicSessionUser.username || makePublicSessionUser().username);
        publicSessionUser.classId = String(publicSessionUser.classId || 'abilities');
        if (store) {
            try {
                store.setItem(PUBLIC_SESSION_USER_KEY, JSON.stringify(publicSessionUser));
            } catch (_err) {
                // no-op
            }
        }
        return publicSessionUser;
    }

    function regenerateArenaIdentity() {
        var store = sessionStore();
        socketPlayerId = makeSocketPlayerId();
        if (store) {
            try {
                store.setItem(SOCKET_PLAYER_ID_KEY, socketPlayerId);
            } catch (_err) {
                // no-op
            }
        }
        return writePublicSessionUser(null);
    }

    function ensureIdentityChannel() {
        if (identityChannel || typeof BroadcastChannel !== 'function') return identityChannel;
        identityChannel = new BroadcastChannel('mayhem-arena-identity');
        identityChannel.addEventListener('message', function (event) {
            var data = event && event.data ? event.data : null;
            if (!data || data.type !== 'identity_probe') return;
            if (!data.playerId || data.tabToken === runtimeTabToken) return;
            if (String(data.playerId) !== String(getSocketPlayerId())) return;
            identityChannel.postMessage({
                type: 'identity_claimed',
                probeId: String(data.probeId || ''),
                playerId: String(data.playerId),
                responderTabToken: runtimeTabToken
            });
        });
        return identityChannel;
    }

    function ensureRuntimeTabToken() {
        if (!runtimeTabToken) {
            runtimeTabToken = randomToken('tab_');
        }
        return runtimeTabToken;
    }

    function probeArenaIdentity() {
        var channel = ensureIdentityChannel();
        var currentIdentity = getSocketIdentity();
        if (!channel || !currentIdentity || !currentIdentity.id) {
            return Promise.resolve(currentIdentity);
        }

        ensureRuntimeTabToken();

        return new Promise(function (resolve) {
            var probeId = randomToken('probe_');
            var conflictDetected = false;
            var settled = false;

            function cleanup() {
                if (settled) return;
                settled = true;
                channel.removeEventListener('message', onMessage);
            }

            function onMessage(event) {
                var data = event && event.data ? event.data : null;
                if (!data || data.type !== 'identity_claimed') return;
                if (String(data.probeId || '') !== probeId) return;
                if (String(data.playerId || '') !== String(getSocketPlayerId())) return;
                if (String(data.responderTabToken || '') === runtimeTabToken) return;
                conflictDetected = true;
            }

            channel.addEventListener('message', onMessage);
            channel.postMessage({
                type: 'identity_probe',
                probeId: probeId,
                playerId: String(currentIdentity.id),
                tabToken: runtimeTabToken
            });

            window.setTimeout(function () {
                cleanup();
                if (conflictDetected) {
                    resolve(regenerateArenaIdentity());
                    return;
                }
                resolve(getSocketIdentity());
            }, 40);
        });
    }

    function getSocketIdentity() {
        if (!publicSessionUser) {
            var store = sessionStore();
            if (store) {
                try {
                    publicSessionUser = JSON.parse(store.getItem(PUBLIC_SESSION_USER_KEY) || 'null');
                } catch (_err) {
                    publicSessionUser = null;
                }
            }
            if (!publicSessionUser || typeof publicSessionUser !== 'object') {
                publicSessionUser = makePublicSessionUser();
            }
            writePublicSessionUser(publicSessionUser);
        }
        return publicSessionUser;
    }

    function getMenuGuestUser() {
        if (!menuGuestUser) {
            menuGuestUser = makeMenuGuestUser();
        }
        return menuGuestUser;
    }

    function getPartyIdentity() {
        if (user && !guestMode) {
            return {
                id: String(user.id || ''),
                username: String(user.username || user.displayName || 'PLAYER'),
                classId: String(user.classId || 'abilities'),
                label: 'PLAYER ID',
                kind: 'account'
            };
        }
        var guest = getMenuGuestUser();
        return {
            id: String(guest.id || ''),
            username: String(guest.username || 'PLAYER'),
            classId: String(guest.classId || 'abilities'),
            label: 'GUEST ID',
            kind: 'guest'
        };
    }

    function authUiApi() {
        if (authUi) return authUi;
        var factory = globalThis.__MAYHEM_RUNTIME && globalThis.__MAYHEM_RUNTIME.GameAuthUi;
        if (!factory || typeof factory.create !== 'function') return null;
        authUi = factory.create({
            getUser: function () { return user; },
            isGuest: function () { return guestMode; },
            getOwnProfile: function () { return ownProfile; },
            login: function (username, pin) { return GameNetAuth.login(username, pin); },
            logout: function () { return GameNetAuth.logout(); },
            localMode: function () {
                guestMode = true;
                user = null;
                ownProfile = null;
                emitAuthChanged();
            },
            loadProfile: function () { return loadOwnProfile(); }
        });
        return authUi;
    }

    function setAuthStatus(msg, isErr) {
        var ui = authUiApi();
        if (ui && ui.setStatus) ui.setStatus(msg, isErr);
    }

    function setAuthVisible(visible) {
        var ui = authUiApi();
        if (ui && ui.setVisible) ui.setVisible(visible);
    }

    function renderAuthPanel() {
        var ui = authUiApi();
        if (ui && ui.render) ui.render();
    }

    function rememberSignedInUser(nextUser) {
        guestMode = false;
        user = nextUser || null;
        renderAuthPanel();
        emitAuthChanged();
    }

    function loadOwnProfile() {
        if (!user || guestMode) {
            ownProfile = null;
            renderAuthPanel();
            return Promise.resolve(null);
        }

        return apiFetch(profileMeUrl())
            .then(readApiResponse)
            .then(function (res) {
                if (res.body && res.body.ok) {
                    ownProfile = res.body.profile || null;
                } else {
                    ownProfile = null;
                }
                renderAuthPanel();
                return ownProfile;
            })
            .catch(function () {
                ownProfile = null;
                renderAuthPanel();
                return null;
            });
    }

    function fetchExistingSession() {
        if (guestMode) return Promise.resolve(null);

        return apiFetch(sessionMeUrl())
            .then(readApiResponse)
            .then(function (res) {
                if (res.body && res.body.ok) {
                    rememberSignedInUser(res.body.user);
                    return loadOwnProfile().then(function () {
                        return user;
                    });
                }
                user = null;
                ownProfile = null;
                renderAuthPanel();
                return null;
            })
            .catch(function () {
                renderAuthPanel();
                return null;
            });
    }

    function bindMenuAuthUi() {
        if (uiBound) return;
        uiBound = true;
        var ui = authUiApi();
        if (ui && ui.bind) ui.bind();
        renderAuthPanel();
    }

    // --- Public API ---

    GameNetAuth.login = function (username, pin) {
        return new Promise(function (resolve, reject) {
            apiFetch(sessionLoginUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, pin: pin })
            })
                .then(readApiResponse)
                .then(function (res) {
                    if (!res.body || !res.body.ok) {
                        reject(new Error(apiErrorMessage(res, 'Login failed.')));
                        return;
                    }
                    rememberSignedInUser(res.body.user);
                    resolve(user);
                })
                .catch(reject);
        });
    };

    GameNetAuth.logout = function () {
        if (guestMode || !user) {
            guestMode = false;
            user = null;
            ownProfile = null;
            setAuthVisible(false);
            setAuthStatus('', false);
            renderAuthPanel();
            emitAuthChanged();
            return Promise.resolve();
        }

        return apiFetch(sessionLogoutUrl(), { method: 'POST' })
            .finally(function () {
                guestMode = false;
                user = null;
                ownProfile = null;
                setAuthVisible(true);
                setAuthStatus('Logged out. ' + AUTH_COOKIE_HELP, false);
                renderAuthPanel();
                emitAuthChanged();
            });
    };

    GameNetAuth.fetchMe = function () {
        return fetchExistingSession();
    };

    GameNetAuth.isLoggedIn = function () {
        return !!(user && !guestMode);
    };

    GameNetAuth.getUser = function () {
        return user;
    };

    GameNetAuth.isGuest = function () {
        return guestMode;
    };

    GameNetAuth.enableGuestMode = function () {
        return getSocketIdentity();
    };

    GameNetAuth.getCurrentUser = function () {
        if (user && !guestMode) {
            return user;
        }
        var identity = getPartyIdentity();
        if (!identity) return null;
        return {
            id: String(identity.id || ''),
            username: String(identity.username || identity.id || 'PLAYER'),
            classId: String(identity.classId || 'abilities')
        };
    };

    GameNetAuth.getOwnProfile = function () {
        return ownProfile;
    };

    GameNetAuth.getSocketPlayerId = function () {
        return getSocketPlayerId();
    };

    GameNetAuth.getSocketIdentity = function () {
        return getSocketIdentity();
    };

    GameNetAuth.getPartyIdentity = function () {
        return getPartyIdentity();
    };

    GameNetAuth.enablePublicMode = function () {
        return getSocketIdentity();
    };

    GameNetAuth.ensureArenaIdentity = function () {
        if (arenaIdentityReadyPromise) return arenaIdentityReadyPromise;
        arenaIdentityReadyPromise = probeArenaIdentity().finally(function () {
            arenaIdentityReadyPromise = null;
        });
        return arenaIdentityReadyPromise;
    };

    GameNetAuth.forceNewArenaIdentity = function () {
        menuGuestUser = null;
        return regenerateArenaIdentity();
    };

    GameNetAuth.clearUser = function () {
        guestMode = false;
        user = null;
        ownProfile = null;
        renderAuthPanel();
        emitAuthChanged();
    };

    GameNetAuth.setUser = function (u) {
        rememberSignedInUser(u);
    };

    GameNetAuth.initMenuAuth = function () {
        bindMenuAuthUi();
        GameNetAuth.ensureMenuSession().catch(function () {
            renderAuthPanel();
        });
    };

    GameNetAuth.ensureMenuSession = function () {
        if (user && !guestMode) return Promise.resolve(user);
        if (guestMode) return Promise.resolve(null);
        if (sessionFetchPromise) return sessionFetchPromise;
        sessionFetchPromise = fetchExistingSession().finally(function () {
            sessionFetchPromise = null;
        });
        return sessionFetchPromise;
    };

    GameNetAuth.requireAuth = function (onAuthed) {
        var modeAuth = authMode();
        if (modeAuth === 'none') {
            guestMode = false;
            user = null;
            ownProfile = null;
            setAuthVisible(false);
            setAuthStatus('', false);
            renderAuthPanel();
            onAuthed(null);
            return;
        }
        if (modeAuth === 'public' || modeAuth === 'guest') {
            onAuthed(getSocketIdentity());
            return;
        }

        bindMenuAuthUi();
        setAuthVisible(true);
        setAuthStatus('Checking session...', false);

        GameNetAuth.ensureMenuSession()
            .then(function (resolvedUser) {
                if (resolvedUser) {
                    setAuthVisible(false);
                    onAuthed(resolvedUser);
                    return;
                }

                setAuthVisible(true);
                setAuthStatus(AUTH_COOKIE_HELP, false);
            })
            .catch(function () {
                setAuthVisible(true);
                setAuthStatus('Could not reach auth API. ' + AUTH_COOKIE_HELP, true);
            });
    };

    GameNetAuth.setAuthVisible = setAuthVisible;
    GameNetAuth.setAuthStatus = setAuthStatus;

    globalThis.__MAYHEM_RUNTIME.GameNetAuth = GameNetAuth;
})();

/**
 * net/auth.js - Authentication module extracted from network.js
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameNetAuth
 */
(function () {
    'use strict';

    var GameNetAuth = {};

    var PROTOCOL = (globalThis.__MAYHEM_RUNTIME.GameShared && globalThis.__MAYHEM_RUNTIME.GameShared.protocol) ? globalThis.__MAYHEM_RUNTIME.GameShared.protocol : null;
    var AUTH_PATH = (PROTOCOL && PROTOCOL.authPath) ? PROTOCOL.authPath : {};

    var AUTH_COOKIE_HELP = 'Username + 4-digit PIN';

    var user = null;
    var guestMode = false;

    function runtimeProfile() {
        return globalThis.__MAYHEM_RUNTIME.GameRuntimeProfile || null;
    }

    function selectedMode() {
        var runtime = runtimeProfile();
        return (runtime && runtime.getSelectedMode) ? runtime.getSelectedMode() : null;
    }

    function authMode() {
        var mode = selectedMode();
        return (mode && mode.authMode) ? mode.authMode : 'guest';
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

    function makeGuestUser() {
        var nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
        return {
            id: 'guest-' + Date.now().toString(36) + '-' + nonce.toLowerCase(),
            username: 'Guest-' + nonce,
            classId: 'abilities'
        };
    }

    function authOverlay() {
        return document.getElementById('auth-overlay');
    }

    function setAuthStatus(msg, isErr) {
        var el = document.getElementById('auth-status');
        if (!el) return;
        el.textContent = msg || '';
        el.style.color = isErr ? '#ff9a9a' : '#d4ffd4';
    }

    function setAuthVisible(visible) {
        var overlay = authOverlay();
        if (!overlay) return;
        overlay.style.display = visible ? 'flex' : 'none';
    }

    function bindAuthForm(onAuthed) {
        var form = document.getElementById('auth-form');
        if (!form) {
            onAuthed(null);
            return;
        }

        var usernameInput = document.getElementById('auth-username');
        var pinInput = document.getElementById('auth-pin');
        var playBtn = document.getElementById('auth-play-btn');
        var logoutBtn = document.getElementById('auth-logout-btn');
        var localBtn = document.getElementById('auth-local-btn');

        function lockForm(lock) {
            if (usernameInput) usernameInput.disabled = lock;
            if (pinInput) pinInput.disabled = lock;
            if (playBtn) playBtn.disabled = lock;
            if (logoutBtn) logoutBtn.disabled = lock;
            if (localBtn) localBtn.disabled = lock;
        }

        function doLogin(username, pin) {
            lockForm(true);
            setAuthStatus('Signing in...', false);

            apiFetch(sessionLoginUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, pin: pin })
            })
                .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
                .then(function (res) {
                    lockForm(false);
                    if (!res.body || !res.body.ok) {
                        setAuthStatus((res.body && res.body.error) || 'Login failed.', true);
                        return;
                    }

                    user = res.body.user;
                    setAuthStatus('Welcome, ' + user.username + '!', false);
                    setAuthVisible(false);
                    onAuthed(user);
                })
                .catch(function () {
                    lockForm(false);
                    setAuthStatus('Network error during login.', true);
                });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var username = usernameInput ? usernameInput.value.trim() : '';
            var pin = pinInput ? pinInput.value.trim() : '';
            if (!username) {
                setAuthStatus('Enter a username.', true);
                return;
            }
            if (!/^\d{4}$/.test(pin)) {
                setAuthStatus('PIN must be exactly 4 digits.', true);
                return;
            }
            doLogin(username, pin);
        });

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                GameNetAuth.logout()
                    .finally(function () {
                        user = null;
                        setAuthVisible(true);
                        setAuthStatus('Logged out. ' + AUTH_COOKIE_HELP, false);
                    });
            });
        }

        if (localBtn) {
            localBtn.addEventListener('click', function () {
                lockForm(true);
                user = null;
                setAuthStatus('Bypassed login. Starting local mode...', false);
                setAuthVisible(false);
                onAuthed(null);
            });
        }
    }

    // --- Public API ---

    GameNetAuth.login = function (username, pin) {
        return new Promise(function (resolve, reject) {
            apiFetch(sessionLoginUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, pin: pin })
            })
                .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
                .then(function (res) {
                    if (!res.body || !res.body.ok) {
                        reject(new Error((res.body && res.body.error) || 'Login failed.'));
                        return;
                    }
                    user = res.body.user;
                    resolve(user);
                })
                .catch(reject);
        });
    };

    GameNetAuth.logout = function () {
        if (guestMode || authMode() !== 'account') {
            guestMode = false;
            user = null;
            setAuthVisible(false);
            setAuthStatus('', false);
            return Promise.resolve();
        }

        return apiFetch(sessionLogoutUrl(), { method: 'POST' })
            .finally(function () {
                guestMode = false;
                user = null;
                setAuthVisible(true);
                setAuthStatus('Logged out.', false);
            });
    };

    GameNetAuth.fetchMe = function () {
        return apiFetch(sessionMeUrl())
            .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
            .then(function (res) {
                if (res.body && res.body.ok) {
                    user = res.body.user;
                    return user;
                }
                return null;
            });
    };

    GameNetAuth.isLoggedIn = function () {
        return !!user;
    };

    GameNetAuth.getUser = function () {
        return user;
    };

    GameNetAuth.isGuest = function () {
        return guestMode;
    };

    GameNetAuth.enableGuestMode = function () {
        guestMode = true;
        if (!user) {
            user = makeGuestUser();
        }
        setAuthVisible(false);
        setAuthStatus('', false);
        return user;
    };

    GameNetAuth.getCurrentUser = function () {
        if (guestMode && !user) {
            user = makeGuestUser();
        }
        return user;
    };

    GameNetAuth.clearUser = function () {
        guestMode = false;
        user = null;
    };

    GameNetAuth.setUser = function (u) {
        user = u;
    };

    GameNetAuth.requireAuth = function (onAuthed) {
        var modeAuth = authMode();
        if (modeAuth === 'none') {
            guestMode = false;
            user = null;
            setAuthVisible(false);
            setAuthStatus('', false);
            onAuthed(null);
            return;
        }
        if (modeAuth === 'guest') {
            onAuthed(GameNetAuth.enableGuestMode());
            return;
        }

        bindAuthForm(function (userObj) {
            onAuthed(userObj || user);
        });

        setAuthVisible(true);
        setAuthStatus('Checking session...', false);

        apiFetch(sessionMeUrl())
            .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
            .then(function (res) {
                if (res.body && res.body.ok) {
                    user = res.body.user;
                    setAuthVisible(false);
                    onAuthed(user);
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

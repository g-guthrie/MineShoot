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
    var uiBound = false;
    var sessionFetchPromise = null;

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

    function makeGuestUser() {
        var nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
        return {
            id: 'guest-' + Date.now().toString(36) + '-' + nonce.toLowerCase(),
            username: 'Guest-' + nonce,
            classId: 'default'
        };
    }

    function authOverlay() {
        return document.getElementById('auth-overlay');
    }

    function authToggleBtn() {
        return document.getElementById('account-toggle-btn');
    }

    function setAuthStatus(msg, isErr) {
        var el = document.getElementById('auth-status');
        if (!el) return;
        el.textContent = msg || '';
        el.style.color = isErr ? '#ff9a9a' : '#d4ffd4';
    }

    function setAuthVisible(visible) {
        var overlay = authOverlay();
        var toggle = authToggleBtn();
        if (overlay) overlay.hidden = !visible;
        if (toggle) toggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
    }

    function localEnvironment() {
        var host = String(window.location.hostname || '').toLowerCase();
        return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
    }

    function syncAuthCta() {
        var toggle = authToggleBtn();
        if (toggle) {
            toggle.textContent = (user && !guestMode)
                ? String(user.username || 'PLAYER')
                : 'LOGIN';
        }
    }

    function renderProfileSummary() {
        var profileName = document.getElementById('auth-profile-name');
        var profileSummary = document.getElementById('auth-profile-summary');
        var profileKills = document.getElementById('auth-profile-kills');
        var profileDeaths = document.getElementById('auth-profile-deaths');
        var profileDamage = document.getElementById('auth-profile-damage');
        var profile = ownProfile || {};
        var summaryUser = user || {};

        if (profileName) {
            profileName.textContent = String(profile.displayName || summaryUser.displayName || summaryUser.username || 'PLAYER');
        }
        if (profileSummary) {
            profileSummary.textContent = profile.enabled
                ? 'Profile is live. Later this slot can hold personalized home screen data.'
                : 'Signed in and ready. For now this mainly reserves your username.';
        }
        if (profileKills) profileKills.textContent = String(Number(profile.kills != null ? profile.kills : summaryUser.kills) || 0);
        if (profileDeaths) profileDeaths.textContent = String(Number(profile.deaths != null ? profile.deaths : summaryUser.deaths) || 0);
        if (profileDamage) {
            profileDamage.textContent =
                String(Number(profile.damageDone != null ? profile.damageDone : summaryUser.damageDone) || 0) +
                ' / ' +
                String(Number(profile.damageTaken != null ? profile.damageTaken : summaryUser.damageTaken) || 0);
        }
    }

    function renderAuthPanel() {
        var loginView = document.getElementById('auth-login-view');
        var profileView = document.getElementById('auth-profile-view');
        var localBtn = document.getElementById('auth-local-btn');
        var loggedIn = !!(user && !guestMode);

        if (loginView) loginView.hidden = loggedIn;
        if (profileView) profileView.hidden = !loggedIn;
        if (localBtn) localBtn.style.display = localEnvironment() ? '' : 'none';

        if (!loggedIn) {
            ownProfile = null;
        } else {
            renderProfileSummary();
        }

        syncAuthCta();
    }

    function rememberSignedInUser(nextUser) {
        guestMode = false;
        user = nextUser || null;
        renderAuthPanel();
    }

    function loadOwnProfile() {
        if (!user || guestMode) {
            ownProfile = null;
            renderAuthPanel();
            return Promise.resolve(null);
        }

        return apiFetch(profileMeUrl())
            .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
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
            .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
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

        var form = document.getElementById('auth-form');
        var usernameInput = document.getElementById('auth-username');
        var pinInput = document.getElementById('auth-pin');
        var playBtn = document.getElementById('auth-play-btn');
        var logoutBtn = document.getElementById('auth-logout-btn');
        var localBtn = document.getElementById('auth-local-btn');
        var closeBtn = document.getElementById('auth-close-btn');
        var toggleBtn = authToggleBtn();

        function lockForm(lock) {
            if (usernameInput) usernameInput.disabled = lock;
            if (pinInput) pinInput.disabled = lock;
            if (playBtn) playBtn.disabled = lock;
            if (logoutBtn) logoutBtn.disabled = lock;
            if (localBtn) localBtn.disabled = lock;
        }

        if (form) {
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

                lockForm(true);
                setAuthStatus('Signing in...', false);
                GameNetAuth.login(username, pin)
                    .then(function () {
                        setAuthStatus('Welcome, ' + String(user && user.username || username) + '!', false);
                        return loadOwnProfile();
                    })
                    .then(function () {
                        lockForm(false);
                        setAuthVisible(false);
                    })
                    .catch(function (err) {
                        lockForm(false);
                        setAuthStatus((err && err.message) ? err.message : 'Login failed.', true);
                    });
            });
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                var nextVisible = !!(authOverlay() && authOverlay().hidden);
                renderAuthPanel();
                setAuthVisible(nextVisible);
                if (nextVisible && user && !guestMode) {
                    loadOwnProfile();
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                setAuthVisible(false);
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                GameNetAuth.logout();
            });
        }

        if (localBtn) {
            localBtn.addEventListener('click', function () {
                guestMode = true;
                user = null;
                ownProfile = null;
                setAuthStatus('Bypassed login. Starting local mode...', false);
                renderAuthPanel();
                setAuthVisible(false);
            });
        }

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
                .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
                .then(function (res) {
                    if (!res.body || !res.body.ok) {
                        reject(new Error((res.body && res.body.error) || 'Login failed.'));
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
        if (user && !guestMode) {
            renderAuthPanel();
            return user;
        }
        guestMode = true;
        if (!user) {
            user = makeGuestUser();
        }
        ownProfile = null;
        setAuthVisible(false);
        setAuthStatus('', false);
        renderAuthPanel();
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
        ownProfile = null;
        renderAuthPanel();
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
        if (modeAuth === 'guest') {
            onAuthed(GameNetAuth.enableGuestMode());
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

/**
 * auth-ui.js - Menu auth panel wiring and rendering.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameAuthUi
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

    function create(opts) {
        opts = opts || {};
        var bound = false;
        var authConfig = { turnstile: { enabled: false, siteKey: '' } };
        var authConfigPromise = null;
        var turnstileToken = '';
        var turnstileWidgetId = null;

        function authOverlay() {
            return document.getElementById('auth-overlay');
        }

        function authToggleBtn() {
            return document.getElementById('account-toggle-btn');
        }

        function authModalManager() {
            return runtime.GameModalManager || null;
        }

        function setStatus(msg, isErr) {
            var el = document.getElementById('auth-status');
            if (!el) return;
            el.textContent = msg || '';
            el.style.color = isErr ? '#ff9a9a' : '#d4ffd4';
        }

        function turnstileWrap() {
            return document.getElementById('auth-turnstile-wrap');
        }

        function turnstileEl() {
            return document.getElementById('auth-turnstile');
        }

        function turnstileApi() {
            return window.turnstile || null;
        }

        function clearTurnstileToken() {
            turnstileToken = '';
        }

        function loadAuthConfig(forceRefresh) {
            if (!opts.loadAuthConfig) {
                authConfig = { turnstile: { enabled: false, siteKey: '' } };
                return Promise.resolve(authConfig);
            }
            if (!forceRefresh && authConfigPromise) return authConfigPromise;
            authConfigPromise = Promise.resolve(opts.loadAuthConfig(!!forceRefresh))
                .then(function (nextConfig) {
                    authConfig = nextConfig && nextConfig.turnstile
                        ? nextConfig
                        : { turnstile: { enabled: false, siteKey: '' } };
                    return authConfig;
                })
                .catch(function () {
                    authConfig = { turnstile: { enabled: false, siteKey: '' } };
                    return authConfig;
                })
                .finally(function () {
                    authConfigPromise = null;
                });
            return authConfigPromise;
        }

        function renderTurnstileWidget() {
            var wrap = turnstileWrap();
            var target = turnstileEl();
            var turnstile = turnstileApi();
            var enabled = !!(authConfig && authConfig.turnstile && authConfig.turnstile.enabled && authConfig.turnstile.siteKey);
            if (wrap) wrap.hidden = !enabled;
            if (!enabled || !target) {
                clearTurnstileToken();
                return;
            }
            if (!turnstile || typeof turnstile.render !== 'function') return;
            if (turnstileWidgetId !== null) return;
            turnstileWidgetId = turnstile.render(target, {
                sitekey: String(authConfig.turnstile.siteKey || ''),
                callback: function (token) {
                    turnstileToken = String(token || '');
                },
                'expired-callback': function () {
                    clearTurnstileToken();
                },
                'error-callback': function () {
                    clearTurnstileToken();
                }
            });
        }

        function resetTurnstileWidget() {
            clearTurnstileToken();
            var turnstile = turnstileApi();
            if (turnstile && turnstileWidgetId !== null && typeof turnstile.reset === 'function') {
                turnstile.reset(turnstileWidgetId);
            }
        }

        function setVisible(visible) {
            var overlay = authOverlay();
            var toggle = authToggleBtn();
            var modalManager = authModalManager();
            if (modalManager && overlay) {
                if (visible) {
                    modalManager.open('auth', toggle || document.activeElement || null);
                } else {
                    modalManager.close('auth');
                }
            } else if (overlay) {
                overlay.hidden = !visible;
            }
            if (toggle) toggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
        }

        function localEnvironment() {
            var runtimeProfile = runtime.GameRuntimeProfile || null;
            if (runtimeProfile && runtimeProfile.isLocalEnvironment) {
                return !!runtimeProfile.isLocalEnvironment();
            }
            var host = String(window.location.hostname || '').toLowerCase();
            return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
        }

        function formatClassName(classId) {
            return String(classId || 'abilities').replace(/[_-]+/g, ' ').toUpperCase();
        }

        function renderProfileSummary() {
            var profileName = document.getElementById('auth-profile-name');
            var profileSummary = document.getElementById('auth-profile-summary');
            var profileClass = document.getElementById('auth-profile-class');
            var profileKills = document.getElementById('auth-profile-kills');
            var profileDeaths = document.getElementById('auth-profile-deaths');
            var profileDamage = document.getElementById('auth-profile-damage');
            var profile = opts.getOwnProfile ? (opts.getOwnProfile() || {}) : {};
            var user = opts.getUser ? (opts.getUser() || {}) : {};

            if (profileName) {
                profileName.textContent = String(profile.displayName || user.displayName || user.username || 'PLAYER');
            }
            if (profileSummary) {
                profileSummary.textContent = profile.enabled
                    ? 'Profile is live. Later this slot can hold personalized home screen data.'
                    : 'Signed in and ready. For now this mainly reserves your username.';
            }
            if (profileClass) profileClass.textContent = formatClassName(profile.classId || user.classId || 'abilities');
            if (profileKills) profileKills.textContent = String(Number(profile.kills != null ? profile.kills : user.kills) || 0);
            if (profileDeaths) profileDeaths.textContent = String(Number(profile.deaths != null ? profile.deaths : user.deaths) || 0);
            if (profileDamage) {
                profileDamage.textContent =
                    String(Number(profile.damageDone != null ? profile.damageDone : user.damageDone) || 0) +
                    ' / ' +
                    String(Number(profile.damageTaken != null ? profile.damageTaken : user.damageTaken) || 0);
            }
        }

        function render() {
            var loginView = document.getElementById('auth-login-view');
            var profileView = document.getElementById('auth-profile-view');
            var localBtn = document.getElementById('auth-local-btn');
            var toggle = authToggleBtn();
            var user = opts.getUser ? opts.getUser() : null;
            var guestMode = opts.isGuest ? opts.isGuest() : false;
            var loggedIn = !!(user && !guestMode);

            if (loginView) loginView.hidden = loggedIn;
            if (profileView) profileView.hidden = !loggedIn;
            if (localBtn) localBtn.style.display = localEnvironment() ? '' : 'none';
            if (toggle) {
                toggle.textContent = loggedIn ? String(user.username || 'PLAYER') : 'LOGIN';
            }
            if (loggedIn) {
                renderProfileSummary();
            } else {
                loadAuthConfig(false).then(function () {
                    renderTurnstileWidget();
                });
            }
        }

        function bind() {
            if (bound) return;
            bound = true;

            var form = document.getElementById('auth-form');
            var usernameInput = document.getElementById('auth-username');
            var pinInput = document.getElementById('auth-pin');
            var playBtn = document.getElementById('auth-play-btn');
            var logoutBtn = document.getElementById('auth-logout-btn');
            var localBtn = document.getElementById('auth-local-btn');
            var closeBtn = document.getElementById('auth-close-btn');
            var toggleBtn = authToggleBtn();
            var overlayEl = authOverlay();
            var modalManager = authModalManager();

            function lockForm(lock) {
                if (usernameInput) usernameInput.disabled = lock;
                if (pinInput) pinInput.disabled = lock;
                if (playBtn) playBtn.disabled = lock;
                if (logoutBtn) logoutBtn.disabled = lock;
                if (localBtn) localBtn.disabled = lock;
            }

            if (modalManager && overlayEl) {
                var utilityToggleBtn = document.getElementById('utility-toggle-btn');
                modalManager.register('auth', {
                    element: overlayEl,
                    initialFocus: usernameInput || closeBtn || overlayEl,
                    restoreFocus: utilityToggleBtn || toggleBtn || null,
                    onOpen: function () {
                        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
                    },
                    onClose: function () {
                        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
                    }
                });
            }

            if (form) {
                form.addEventListener('submit', function (e) {
                    e.preventDefault();
                    var username = usernameInput ? usernameInput.value.trim() : '';
                    var pin = pinInput ? pinInput.value.trim() : '';
                    if (!username) {
                        setStatus('Enter a username.', true);
                        return;
                    }
                    if (!/^\d{4}$/.test(pin)) {
                        setStatus('PIN must be exactly 4 digits.', true);
                        return;
                    }
                    if (authConfig && authConfig.turnstile && authConfig.turnstile.enabled && !turnstileToken) {
                        setStatus('Complete the security check.', true);
                        return;
                    }

                    lockForm(true);
                    setStatus('Signing in...', false);
                    Promise.resolve(opts.login ? opts.login(username, pin, turnstileToken) : null)
                        .then(function () {
                            setStatus('Welcome, ' + String((opts.getUser && opts.getUser() && opts.getUser().username) || username) + '!', false);
                            return opts.loadProfile ? opts.loadProfile() : null;
                        })
                        .then(function () {
                            render();
                            lockForm(false);
                            resetTurnstileWidget();
                            setVisible(false);
                        })
                        .catch(function (err) {
                            lockForm(false);
                            resetTurnstileWidget();
                            setStatus((err && err.message) ? err.message : 'Login failed.', true);
                        });
                });
            }

            if (toggleBtn) {
                toggleBtn.addEventListener('click', function () {
                    var nextVisible = !!(authOverlay() && authOverlay().hidden);
                    render();
                    setVisible(nextVisible);
                    if (nextVisible) {
                        loadAuthConfig(false).then(function () {
                            renderTurnstileWidget();
                        });
                    }
                    if (nextVisible && usernameInput && !(opts.getUser && opts.getUser())) {
                        usernameInput.focus();
                    }
                    if (nextVisible && opts.getUser && opts.getUser() && !(opts.isGuest && opts.isGuest()) && opts.loadProfile) {
                        opts.loadProfile();
                    }
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', function () {
                    setVisible(false);
                });
            }

            if (logoutBtn) {
                logoutBtn.addEventListener('click', function () {
                    if (opts.logout) opts.logout();
                });
            }

            if (localBtn) {
                localBtn.addEventListener('click', function () {
                    if (opts.localMode) opts.localMode();
                    setStatus('Bypassed login. Starting local mode...', false);
                    render();
                    setVisible(false);
                });
            }

            render();
        }

        return {
            bind: bind,
            render: render,
            setStatus: setStatus,
            setVisible: setVisible
        };
    }

    runtime.GameAuthUi = {
        create: create
    };
})();

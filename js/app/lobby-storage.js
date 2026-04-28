const RETURN_STATE_KEY = 'mayhem.menu.returnShell.v2';
const LAUNCH_ERROR_KEY = 'mayhem.launchError';

function storageFromWindow(kind, win) {
    try {
        if (!win) return null;
        return kind === 'local' ? (win.localStorage || null) : (win.sessionStorage || null);
    } catch (_err) {
        return null;
    }
}

function menuStores(win) {
    return [
        storageFromWindow('session', win),
        storageFromWindow('local', win)
    ];
}

export function readStoredLaunchError(win) {
    var store = storageFromWindow('session', win);
    if (!store || typeof store.getItem !== 'function') return '';
    try {
        var msg = String(store.getItem(LAUNCH_ERROR_KEY) || '').trim();
        if (msg && typeof store.removeItem === 'function') store.removeItem(LAUNCH_ERROR_KEY);
        return msg;
    } catch (_err) {
        return '';
    }
}

export function readMenuReturnState(win, normalizeMode) {
    var result = null;
    var stores = menuStores(win);
    for (var i = 0; i < stores.length; i++) {
        var store = stores[i];
        if (!store || typeof store.getItem !== 'function') continue;
        try {
            var raw = String(store.getItem(RETURN_STATE_KEY) || '').trim();
            if (raw && !result) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    result = {
                        activeSurface: parsed.activeSurface === 'room' ? 'room' : 'main',
                        selectedMode: normalizeMode(parsed.selectedMode)
                    };
                }
            }
            if (typeof store.removeItem === 'function') store.removeItem(RETURN_STATE_KEY);
        } catch (_err) {
            // no-op
        }
    }
    return result;
}

export function writeMenuReturnState(win, payload, normalizeMode) {
    var value = JSON.stringify({
        activeSurface: payload && payload.activeSurface === 'room' ? 'room' : 'main',
        selectedMode: normalizeMode(payload && payload.selectedMode)
    });
    var stores = menuStores(win);
    for (var i = 0; i < stores.length; i++) {
        var store = stores[i];
        if (!store || typeof store.setItem !== 'function') continue;
        try {
            store.setItem(RETURN_STATE_KEY, value);
        } catch (_err) {
            // no-op
        }
    }
}

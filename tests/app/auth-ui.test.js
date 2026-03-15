import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.hidden = false;
    this.style = {};
    this.textContent = '';
    this.disabled = false;
    this.attributes = {};
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }

  setAttribute(name, value) {
    this.attributes[String(name || '')] = String(value || '');
  }

  focus() {
    return true;
  }
}

async function loadAuthUiHarness({ location, runtimeProfile } = {}) {
  const code = await fs.readFile(new URL('../../js/app/auth-ui.js', import.meta.url), 'utf8');
  const elements = {
    'auth-login-view': new FakeElement('auth-login-view'),
    'auth-profile-view': new FakeElement('auth-profile-view'),
    'auth-local-btn': new FakeElement('auth-local-btn'),
    'account-toggle-btn': new FakeElement('account-toggle-btn')
  };
  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameRuntimeProfile: runtimeProfile || null
      }
    },
    window: {
      location: location || {
        protocol: 'https:',
        hostname: 'example.test'
      }
    },
    document: {
      activeElement: null,
      getElementById(id) {
        return elements[id] || null;
      }
    }
  };

  vm.runInContext(code, vm.createContext(sandbox));
  const authUi = sandbox.globalThis.__MAYHEM_RUNTIME.GameAuthUi.create({
    getUser() { return null; },
    isGuest() { return false; }
  });

  return {
    authUi,
    elements
  };
}

test('auth ui keeps local-mode entry visible when served from 0.0.0.0', async () => {
  const harness = await loadAuthUiHarness({
    location: {
      protocol: 'http:',
      hostname: '0.0.0.0'
    }
  });

  harness.authUi.render();

  assert.equal(harness.elements['auth-local-btn'].style.display, '');
});

test('auth ui defers local-environment detection to the runtime profile when available', async () => {
  let checks = 0;
  const harness = await loadAuthUiHarness({
    location: {
      protocol: 'https:',
      hostname: 'prod.example'
    },
    runtimeProfile: {
      isLocalEnvironment() {
        checks += 1;
        return true;
      }
    }
  });

  harness.authUi.render();

  assert.equal(checks, 1);
  assert.equal(harness.elements['auth-local-btn'].style.display, '');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id || '';
    this.hidden = false;
    this.style = {};
    this.textContent = '';
    this.isContentEditable = false;
    this.listeners = new Map();
    this.classList = {
      remove() {}
    };
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }
}

async function loadMenuShell(toggleDocs) {
  const code = await fs.readFile(new URL('../../js/app/menu-shell.js', import.meta.url), 'utf8');
  const elements = {
    'open-manual-btn': new FakeElement('button', 'open-manual-btn'),
    'hud-manual-btn': new FakeElement('button', 'hud-manual-btn'),
    'auth-username': new FakeElement('input', 'auth-username')
  };
  const documentListeners = new Map();
  const documentObj = {
    readyState: 'complete',
    body: new FakeElement('body', 'body'),
    fonts: null,
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector() {
      return null;
    },
    addEventListener(type, handler) {
      const key = String(type || '');
      const next = documentListeners.get(key) || [];
      next.push(handler);
      documentListeners.set(key, next);
    }
  };
  const windowObj = {
    __mayhemDocsKeyBound: false,
    setTimeout(handler) {
      if (typeof handler === 'function') handler();
      return 1;
    },
    clearTimeout() {},
    requestAnimationFrame(handler) {
      if (typeof handler === 'function') handler();
      return 1;
    }
  };
  const sandbox = {
    globalThis: {
      __MAYHEM_RUNTIME: {
        GameRuntimeLoader: {
          toggleDocs
        }
      }
    },
    window: windowObj,
    document: documentObj,
    console
  };

  vm.runInContext(code, vm.createContext(sandbox));

  return {
    authUsername: elements['auth-username'],
    dispatchKeydown(event) {
      const list = documentListeners.get('keydown') || [];
      for (let i = 0; i < list.length; i++) {
        list[i](event);
      }
    }
  };
}

test('menu docs shortcut ignores typing in editable fields but still works elsewhere', async () => {
  let toggleCount = 0;
  const harness = await loadMenuShell(function () {
    toggleCount += 1;
  });

  harness.dispatchKeydown({
    code: 'KeyI',
    target: harness.authUsername,
    currentTarget: null,
    preventDefault() {
      throw new Error('preventDefault should not fire for editable targets');
    },
    stopPropagation() {
      throw new Error('stopPropagation should not fire for editable targets');
    }
  });

  assert.equal(toggleCount, 0);

  let prevented = false;
  harness.dispatchKeydown({
    code: 'KeyI',
    target: new FakeElement('div', 'menu-shell'),
    currentTarget: null,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {}
  });

  assert.equal(toggleCount, 1);
  assert.equal(prevented, true);
});

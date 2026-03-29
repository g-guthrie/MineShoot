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

async function loadMenuShell(toggleDocs, runtimeOverrides = {}) {
  const [domUtilsCode, code] = await Promise.all([
    fs.readFile(new URL('../../js/core/dom-utils.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/menu-shell.js', import.meta.url), 'utf8')
  ]);
  const elements = {
    'open-manual-btn': new FakeElement('button', 'open-manual-btn'),
    'hud-manual-btn': new FakeElement('button', 'hud-manual-btn'),
    'auth-username': new FakeElement('input', 'auth-username'),
    'mode-screen-title': new FakeElement('h1', 'mode-screen-title'),
    'docs-title': new FakeElement('div', 'docs-title')
  };
  elements['mode-screen-title'].textContent = 'PvP by Greer';
  elements['docs-title'].textContent = 'minecraft fps :: open field manual';
  const documentListeners = new Map();
  const documentObj = {
    readyState: 'complete',
    body: new FakeElement('body', 'body'),
    fonts: null,
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      if (selector === '#overlay h1') return elements['mode-screen-title'];
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
        },
        ...runtimeOverrides
      }
    },
    window: windowObj,
    document: documentObj,
    console
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(domUtilsCode, context);
  vm.runInContext(code, context);

  return {
    authUsername: elements['auth-username'],
    modeScreenTitle: elements['mode-screen-title'],
    docsTitle: elements['docs-title'],
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

test('menu shell branding keeps the home hero heading intact', async () => {
  const harness = await loadMenuShell(function () {});

  assert.equal(harness.modeScreenTitle.textContent, 'PvP by Greer');
  assert.equal(harness.docsTitle.textContent, 'PvP by Greer :: open field manual');
});

test('menu docs shortcut respects a remapped manual key when input bindings are available', async () => {
  let toggleCount = 0;
  const harness = await loadMenuShell(function () {
    toggleCount += 1;
  }, {
    GameInputBindings: {
      matches(actionId, event) {
        return actionId === 'open_manual' && event && event.code === 'KeyJ';
      }
    }
  });

  harness.dispatchKeydown({
    code: 'KeyI',
    target: new FakeElement('div', 'menu-shell'),
    currentTarget: null,
    preventDefault() {
      throw new Error('preventDefault should not fire for the old key');
    },
    stopPropagation() {
      throw new Error('stopPropagation should not fire for the old key');
    }
  });

  assert.equal(toggleCount, 0);

  let prevented = false;
  harness.dispatchKeydown({
    code: 'KeyJ',
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

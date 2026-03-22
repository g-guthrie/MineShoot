import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName = 'div', id = '', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id || '';
    this.ownerDocument = ownerDocument;
    this.hidden = false;
    this.attributes = {};
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.value = '';
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this._classSet = new Set();
    this.classList = {
      add: (...tokens) => {
        for (const token of tokens) this._classSet.add(String(token || ''));
      },
      remove: (...tokens) => {
        for (const token of tokens) this._classSet.delete(String(token || ''));
      },
      toggle: (token, force) => {
        const normalized = String(token || '');
        const next = force === undefined ? !this._classSet.has(normalized) : !!force;
        if (next) this._classSet.add(normalized);
        else this._classSet.delete(normalized);
        return next;
      },
      contains: (token) => this._classSet.has(String(token || ''))
    };
    Object.defineProperty(this, 'innerHTML', {
      get: () => '',
      set: () => {
        this.children = [];
        this.childNodes = this.children;
        this.textContent = '';
      }
    });
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    this.childNodes = this.children;
    return child;
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

  querySelector(selector) {
    const className = selector && selector.startsWith('.') ? selector.slice(1) : '';
    if (!className) return null;
    for (const child of this.children) {
      if (child._classSet && child._classSet.has(className)) return child;
      const found = child.querySelector ? child.querySelector(selector) : null;
      if (found) return found;
    }
    return null;
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
    return true;
  }

  blur() {
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }

  click() {
    const handlers = this.listeners.get('click') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {}
      });
    }
  }

  keydown(event = {}) {
    const handlers = this.listeners.get('keydown') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'keydown',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...event
      });
    }
  }
}

function findByDataset(root, key, value) {
  if (!root) return null;
  if (root.dataset && root.dataset[key] === value) return root;
  const children = Array.isArray(root.children) ? root.children : [];
  for (const child of children) {
    const found = findByDataset(child, key, value);
    if (found) return found;
  }
  return null;
}

async function loadBindingsUiHarness() {
  const [bindingsCode, domUtilsCode, modalCode, uiCode] = await Promise.all([
    fs.readFile(new URL('../../js/core/input-bindings.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/core/dom-utils.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/modal-manager.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../js/app/input-bindings-ui.js', import.meta.url), 'utf8')
  ]);

  const documentObj = {
    activeElement: null,
    elements: {},
    getElementById(id) {
      return this.elements[String(id || '')] || null;
    },
    createElement(tagName) {
      return new FakeElement(tagName, '', this);
    }
  };

  const ids = [
    ['div', 'controls-menu'],
    ['button', 'controls-toggle'],
    ['div', 'controls-menu-grid'],
    ['div', 'controls-overlay'],
    ['button', 'controls-close-btn'],
    ['button', 'controls-reset-btn'],
    ['div', 'controls-rebind-status'],
    ['div', 'controls-fixed-grid'],
    ['div', 'controls-bindings-groups'],
    ['input', 'controls-capture-input']
  ];
  for (const [tagName, id] of ids) {
    documentObj.elements[id] = new FakeElement(tagName, id, documentObj);
  }
  documentObj.elements['controls-overlay'].hidden = true;

  const windowObj = {
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    addEventListener() {}
  };

  const sandbox = {
    console,
    window: windowObj,
    document: documentObj,
    __MAYHEM_RUNTIME: {},
    globalThis: null,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  sandbox.globalThis.window = windowObj;
  sandbox.globalThis.document = documentObj;

  const context = vm.createContext(sandbox);
  vm.runInContext(bindingsCode, context);
  vm.runInContext(domUtilsCode, context);
  vm.runInContext(modalCode, context);
  vm.runInContext(uiCode, context);

  const runtime = sandbox.__MAYHEM_RUNTIME;
  runtime.GameInputBindingsUi.init();

  return {
    runtime,
    elements: documentObj.elements
  };
}

test('input bindings UI opens the modal, swaps conflicting keys, and resets defaults', async () => {
  const harness = await loadBindingsUiHarness();
  const { elements, runtime } = harness;

  const legendText = elements['controls-menu-grid'].children.map((child) => child.textContent);
  assert.equal(legendText.includes('W / A / S / D Move'), true);

  elements['controls-toggle'].click();
  assert.equal(elements['controls-overlay'].hidden, false);

  const sprintBtn = findByDataset(elements['controls-bindings-groups'], 'actionId', 'sprint');
  const moveForwardBtn = findByDataset(elements['controls-bindings-groups'], 'actionId', 'move_forward');
  assert.ok(sprintBtn);
  assert.ok(moveForwardBtn);

  sprintBtn.click();
  assert.match(elements['controls-rebind-status'].textContent, /Sprint/i);

  elements['controls-capture-input'].keydown({ code: 'KeyW' });

  assert.equal(runtime.GameInputBindings.getDisplayLabel('sprint'), 'W');
  assert.equal(runtime.GameInputBindings.getDisplayLabel('move_forward'), 'SHIFT');
  assert.equal(findByDataset(elements['controls-bindings-groups'], 'actionId', 'sprint').textContent, 'W');
  assert.equal(findByDataset(elements['controls-bindings-groups'], 'actionId', 'move_forward').textContent, 'SHIFT');

  const swappedLegend = elements['controls-menu-grid'].children.map((child) => child.textContent);
  assert.equal(swappedLegend.includes('SHIFT / A / S / D Move'), true);
  assert.equal(swappedLegend.includes('W Sprint'), true);

  elements['controls-reset-btn'].click();

  assert.equal(runtime.GameInputBindings.getDisplayLabel('sprint'), 'SHIFT');
  assert.equal(runtime.GameInputBindings.getDisplayLabel('move_forward'), 'W');
  assert.equal(findByDataset(elements['controls-bindings-groups'], 'actionId', 'sprint').textContent, 'SHIFT');
  assert.equal(findByDataset(elements['controls-bindings-groups'], 'actionId', 'move_forward').textContent, 'W');
});

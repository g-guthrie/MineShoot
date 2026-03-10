import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.hidden = true;
    this.attributes = {};
    this.listeners = new Map();
    this.dataset = {};
  }

  setAttribute(name, value) {
    this.attributes[String(name || '')] = String(value || '');
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const next = this.listeners.get(key) || [];
    next.push(handler);
    this.listeners.set(key, next);
  }

  focus() {
    return true;
  }
}

test('modal manager registers, opens, and closes a dialog with aria/hidden semantics', async () => {
  const code = await fs.readFile(new URL('../js/app/modal-manager.js', import.meta.url), 'utf8');
  const overlay = new FakeElement('overlay');
  const trigger = new FakeElement('trigger');
  const documentObj = {
    activeElement: trigger,
    getElementById(id) {
      if (id === 'overlay') return overlay;
      if (id === 'trigger') return trigger;
      return null;
    }
  };
  const windowObj = {
    addEventListener() {}
  };
  const sandbox = {
    globalThis: { __MAYHEM_RUNTIME: {} },
    document: documentObj,
    window: windowObj
  };

  vm.runInContext(code, vm.createContext(sandbox));
  const modalManager = sandbox.globalThis.__MAYHEM_RUNTIME.GameModalManager;

  modalManager.register('test', {
    element: overlay,
    initialFocus: overlay,
    restoreFocus: trigger
  });

  assert.equal(overlay.hidden, true);
  assert.equal(overlay.attributes['aria-hidden'], 'true');

  assert.equal(modalManager.open('test', trigger), true);
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.attributes['aria-hidden'], 'false');
  assert.equal(modalManager.isOpen('test'), true);

  assert.equal(modalManager.close('test'), true);
  assert.equal(overlay.hidden, true);
  assert.equal(overlay.attributes['aria-hidden'], 'true');
  assert.equal(modalManager.isOpen('test'), false);
});

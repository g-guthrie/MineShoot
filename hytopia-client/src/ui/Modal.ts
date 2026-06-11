/**
 * Simple modal system to replace browser alert() and prompt() calls.
 * Returns Promises to handle async user interactions properly.
 */

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (!container || !container.isConnected) {
    container = document.createElement('div');
    container.className = 'hytopia-modal-container';
    document.body.appendChild(container);
  }
  return container;
}

export function modalAlert(message: string): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'hytopia-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'hytopia-modal';

    const msg = document.createElement('div');
    msg.className = 'hytopia-modal-message';
    msg.textContent = message;

    const buttons = document.createElement('div');
    buttons.className = 'hytopia-modal-buttons';

    const ok = document.createElement('button');
    ok.className = 'hytopia-modal-button hytopia-modal-button-ok';
    ok.textContent = 'OK';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') close();
    };

    const close = () => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve();
    };

    ok.onclick = close;
    document.addEventListener('keydown', onKey);

    buttons.appendChild(ok);
    modal.append(msg, buttons);
    overlay.appendChild(modal);
    getContainer().appendChild(overlay);
    ok.focus();
  });
}

export function modalPrompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'hytopia-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'hytopia-modal';

    const msg = document.createElement('div');
    msg.className = 'hytopia-modal-message';
    msg.textContent = message;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'hytopia-modal-input';
    input.value = defaultValue;

    const buttons = document.createElement('div');
    buttons.className = 'hytopia-modal-buttons';

    const cancel = document.createElement('button');
    cancel.className = 'hytopia-modal-button hytopia-modal-button-cancel';
    cancel.textContent = 'Cancel';

    const ok = document.createElement('button');
    ok.className = 'hytopia-modal-button hytopia-modal-button-ok';
    ok.textContent = 'OK';

    const close = (value: string | null) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    };

    ok.onclick = () => close(input.value);
    cancel.onclick = () => close(null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') close(input.value);
      else if (e.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', onKey);

    buttons.append(cancel, ok);
    modal.append(msg, input, buttons);
    overlay.appendChild(modal);
    getContainer().appendChild(overlay);
    input.focus();
    input.select();
  });
}

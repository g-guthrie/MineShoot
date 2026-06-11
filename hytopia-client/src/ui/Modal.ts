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

export interface ModalSelectOption {
  label: string;
  description?: string;
  value: string;
}

export function modalSelect(message: string, options: ModalSelectOption[]): Promise<string | null> {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'hytopia-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'hytopia-modal';

    const msg = document.createElement('div');
    msg.className = 'hytopia-modal-message';
    msg.textContent = message;

    const choices = document.createElement('div');
    choices.className = 'hytopia-modal-choices';

    const close = (value: string | null) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', onKey);

    options.forEach(option => {
      const button = document.createElement('button');
      button.className = 'hytopia-modal-button hytopia-modal-choice';

      const label = document.createElement('div');
      label.className = 'hytopia-modal-choice-label';
      label.textContent = option.label;
      button.appendChild(label);

      if (option.description) {
        const description = document.createElement('div');
        description.className = 'hytopia-modal-choice-description';
        description.textContent = option.description;
        button.appendChild(description);
      }

      button.onclick = () => close(option.value);
      choices.appendChild(button);
    });

    modal.append(msg, choices);
    overlay.appendChild(modal);
    getContainer().appendChild(overlay);
    (choices.firstElementChild as HTMLButtonElement | null)?.focus();
  });
}

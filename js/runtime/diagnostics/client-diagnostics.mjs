const MAX_EVENTS = 200;
const events = [];
let handlersInstalled = false;

function nowIso() {
  return new Date().toISOString();
}

export function recordClientDiagnostic(type, details = {}) {
  const event = {
    type: String(type || 'unknown'),
    at: nowIso(),
    details: details && typeof details === 'object'
      ? JSON.parse(JSON.stringify(details))
      : {}
  };
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  return event;
}

export function getClientDiagnostics() {
  return events.slice();
}

export function clearClientDiagnostics() {
  events.length = 0;
}

export function installGlobalClientDiagnostics(target = globalThis) {
  if (handlersInstalled || !target || typeof target.addEventListener !== 'function') return false;
  handlersInstalled = true;
  target.addEventListener('error', function onError(event) {
    recordClientDiagnostic('window_error', {
      message: event && event.message ? String(event.message) : 'Unknown error'
    });
  });
  target.addEventListener('unhandledrejection', function onUnhandledRejection(event) {
    const reason = event && Object.prototype.hasOwnProperty.call(event, 'reason') ? event.reason : null;
    recordClientDiagnostic('unhandled_rejection', {
      reason: reason && reason.message ? String(reason.message) : String(reason || 'Unknown rejection')
    });
  });
  return true;
}

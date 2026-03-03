export function getThrowablesRuntime() {
  const runtime = globalThis.__MAYHEM_RUNTIME || {};
  return runtime.GameThrowables || null;
}

export function getThrowableCatalog() {
  const throwables = getThrowablesRuntime();
  if (!throwables || typeof throwables.getCatalog !== 'function') return null;
  return throwables.getCatalog();
}


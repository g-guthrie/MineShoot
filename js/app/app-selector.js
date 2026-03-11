export function resolveAppId(search) {
  const rawSearch = typeof search === 'string'
    ? search
    : ((typeof window !== 'undefined' && window.location) ? window.location.search : '');

  let params = null;
  try {
    params = new URLSearchParams(rawSearch || '');
  } catch (err) {
    params = null;
  }

  const requested = String(params && params.get('app') || '').trim().toLowerCase();
  return requested === 'demonic' ? 'demonic' : 'mayhem';
}

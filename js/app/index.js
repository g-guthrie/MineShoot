import { resolveAppId } from './app-selector.js';

globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};

if (resolveAppId() === 'demonic') {
  import('../../demonic/app/index.js');
} else {
  import('./menu-modules.js');
}

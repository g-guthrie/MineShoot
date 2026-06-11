import { modalAlert, modalPrompt } from '../ui/Modal';

// Minimum supported server version
const MINIMUM_SUPPORTED_SERVER_VERSION = '0.10.0';
// Self-hosted: connect straight to the local game server instead of the
// platform's loopback DNS alias (local.hytopiahosting.com), which depends
// on HYTOPIA's infrastructure. Literal IPv4 because the dev server binds
// 0.0.0.0 and "localhost" resolves to ::1 first in Chromium.
const DEV_LOCAL_HOSTNAME = '127.0.0.1:8081';
const SERVER_HEALTH_CHECK_TIMEOUT_MS = 8000;

export function isLocalServer(hostname: string): boolean {
  return /^(([\w-]+\.)*localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[::1\])(:\d+)?$/.test(hostname);
}

export function getHttpProtocol(hostname: string): 'http' | 'https' {
  return isLocalServer(hostname) ? 'http' : 'https';
}

export function getWebSocketProtocol(hostname: string): 'ws' | 'wss' {
  return isLocalServer(hostname) ? 'ws' : 'wss';
}

// Some poor mobile networks can drop TCP connections silently,
// this can cause no response for our fetch, so we use fetch with a timeout.
const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
  } finally {
    clearTimeout(timeoutId);
  }
};

export default class Servers {
  public static async getServerDetails(): Promise<{ hostname: string, lobbyId: string, version: string }> {
    let hostname = '';
    let lobbyId = '';
    let version = '';

    do {
      const urlParams = new URLSearchParams(window.location.search);
      hostname = urlParams.get('join') || '';
      lobbyId = urlParams.get('lobbyId') || '';

      // Prompt for server hostname if not already present in join query parameter
      if (!hostname) {
        hostname = await modalPrompt('Connect to a HYTOPIA server (leave blank for local dev).\nRecommended: use a Chromium browser (Chrome, Brave, Edge).') || DEV_LOCAL_HOSTNAME;
        hostname = hostname.replace(/^(wss?|https?):\/\//, '');
      }

      // Validate server connection
      const isLocal = isLocalServer(hostname);

      try {
        const response = await fetchWithTimeout(`${getHttpProtocol(hostname)}://${hostname}`, {
          targetAddressSpace: isLocal ? 'loopback' : undefined,
        } as RequestInit, SERVER_HEALTH_CHECK_TIMEOUT_MS);

        if (!response.ok) {
          throw new Error(`Could not connect to server: ${hostname}`);
        }

        const serverDetails = await response.json();

        version = serverDetails.version;

        await this._validateServerVersionCompat(version);
      } catch {
        console.error('Could not connect to server', hostname);

        if (isLocal) {
          await modalAlert(
            'Could not connect to your local HYTOPIA server.\n' +
            '----------------\n' +
            '1) Start it: hytopia start\n' +
            '2) Use a Chromium browser (Chrome, Brave, Edge)\n' +
            `3) Confirm the local proxy is running on ${DEV_LOCAL_HOSTNAME}\n` +
            'Then try again.'
          );
        }

        hostname = '';
      }
      
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (!hostname);

    // Append hostname to URL if not already present
    if (!window.location.search.includes('join=')) {      
      let newUrl = `${window.location.pathname}?join=${hostname}`;
      newUrl += window.location.search.includes('debug') ? '&debug' : '';      
      newUrl += window.location.hash;
      
      window.history.pushState({}, '', newUrl);
    }

    return { hostname, lobbyId, version };
  }

  public static async isCurrentServerHealthy(): Promise<boolean> {
    const hostname = (new URLSearchParams(window.location.search)).get('join') || '';

    try {
      const response = await fetchWithTimeout(`${getHttpProtocol(hostname)}://${hostname}`, { method: 'HEAD' }, SERVER_HEALTH_CHECK_TIMEOUT_MS);

      return response.ok;
    } catch {
      return false;
    }
  }

  public static isCurrentServerProduction(): boolean {
    const hostname = (new URLSearchParams(window.location.search)).get('join') || '';
    return hostname.includes('hytopiahosting.com');
  }

  private static async _validateServerVersionCompat(version: string): Promise<void> {
    version = version || '0.0.0'; // needs update, legacy servers don't have a version field.

    if (version.includes('DEV')) {
      return; // SDK dev servers are ignored, ran from the internal hytopia team `server` repo.
    }

    const [majorServer, minorServer, patchServer] = version.split('.').map(Number);
    const [majorMin, minorMin, patchMin] = MINIMUM_SUPPORTED_SERVER_VERSION.split('.').map(Number);

    if (majorServer < majorMin || 
      (majorServer === majorMin && minorServer < minorMin) ||
      (majorServer === majorMin && minorServer === minorMin && patchServer < patchMin)
    ) {
      await modalAlert(
        'This HYTOPIA game is out of date.\n' +
        `It is running SDK version ${version}, which is not supported.\n` +
        `The minimum supported sdk version is >= ${MINIMUM_SUPPORTED_SERVER_VERSION}\n` +
        'You should update your game to the latest sdk version by running the following in your project directory: bun update hytopia\n' +
        'If you are not the developer of this game, please contact the developer to update the sdk version of their game.'
      );

      throw new Error(`Unsupported server version: ${version}`);
    }
  }
}

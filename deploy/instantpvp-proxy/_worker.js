const ORIGIN = 'https://pvp-by-greer.fly.dev';

export default {
  fetch(request) {
    const incomingUrl = new URL(request.url);
    const originUrl = new URL(incomingUrl.pathname + incomingUrl.search, ORIGIN);
    const proxyRequest = new Request(originUrl, request);

    proxyRequest.headers.set('X-Forwarded-Host', incomingUrl.host);
    proxyRequest.headers.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''));

    return fetch(proxyRequest);
  },
};

const PROD_WORKER_ORIGIN = 'https://mayhem.gguthrie-minecraft-fps.workers.dev';
const LOCAL_WORKER_ORIGIN = 'http://127.0.0.1:8787';

function isLocalHost(hostname) {
  if (!hostname) return false;
  const host = String(hostname).toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function resolveWorkerOrigin(context, upstreamUrl) {
  if (context && context.env && context.env.WORKER_ORIGIN) {
    return String(context.env.WORKER_ORIGIN);
  }
  if (isLocalHost(upstreamUrl && upstreamUrl.hostname)) {
    return LOCAL_WORKER_ORIGIN;
  }
  return PROD_WORKER_ORIGIN;
}

export async function onRequest(context) {
  const upstreamUrl = new URL(context.request.url);
  const workerOrigin = resolveWorkerOrigin(context, upstreamUrl);
  const workerUrl = new URL(upstreamUrl.pathname + upstreamUrl.search, workerOrigin);

  const headers = new Headers(context.request.headers);
  headers.delete('host');
  const requestInit = {
    method: context.request.method,
    headers,
    redirect: 'manual'
  };
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    requestInit.body = context.request.body;
  }

  return fetch(new Request(workerUrl.toString(), requestInit));
}

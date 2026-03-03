const WORKER_ORIGIN = 'https://minecraft-fps-arena.gguthrie-minecraft-fps.workers.dev';

export async function onRequest(context) {
  const upstreamUrl = new URL(context.request.url);
  const workerUrl = new URL(upstreamUrl.pathname + upstreamUrl.search, WORKER_ORIGIN);

  const headers = new Headers(context.request.headers);
  headers.delete('host');

  const init = {
    method: context.request.method,
    headers,
    redirect: 'manual'
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
  }

  return fetch(workerUrl, init);
}

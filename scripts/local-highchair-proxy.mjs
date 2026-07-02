// Local dev proxy: browsers reject the Highchair dev server's self-signed
// TLS, so PvP gets a plain http/ws listener forwarded to its https/wss
// server. Dev-only - never expose this (it disables certificate
// verification and strips transport encryption).
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const LISTEN_HOST = process.env.PROXY_LISTEN_HOST || '127.0.0.1'; // 0.0.0.0 in the Fly container
const TARGET_HOST = '127.0.0.1';
// Single-app deploys: serve the built client from this directory so one
// origin hosts both the page and the game (files that exist here win;
// everything else forwards to the game server).
const CLIENT_DIST = process.env.CLIENT_DIST || '';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function tryServeStatic(clientReq, clientRes) {
  if (!CLIENT_DIST || (clientReq.method !== 'GET' && clientReq.method !== 'HEAD')) return false;
  const urlPath = decodeURIComponent(new URL(clientReq.url, 'http://x').pathname);
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  if (rel === 'index.html' && !String(clientReq.headers.accept || '').includes('text/html')) {
    return false;
  }
  const file = path.join(CLIENT_DIST, rel);
  if (!file.startsWith(path.resolve(CLIENT_DIST))) return false; // no traversal
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  clientRes.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
  });
  if (clientReq.method === 'HEAD') return clientRes.end(), true;
  fs.createReadStream(file).pipe(clientRes);
  return true;
}

const ROUTES = [
  { name: 'pvp', listenPort: 8083, targetPort: 8082 },
];

const targetAgent = new https.Agent({
  rejectUnauthorized: false,
});

function createProxy({ name, listenPort, targetPort }) {
  const forwardHeaders = (headers) => {
    const copy = { ...headers };
    copy.host = `${TARGET_HOST}:${targetPort}`;
    return copy;
  };

  const server = http.createServer((clientReq, clientRes) => {
    if (tryServeStatic(clientReq, clientRes)) return;

    const proxyReq = https.request({
      agent: targetAgent,
      headers: forwardHeaders(clientReq.headers),
      hostname: TARGET_HOST,
      method: clientReq.method,
      path: clientReq.url,
      port: targetPort,
      rejectUnauthorized: false,
    }, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(clientRes);
    });

    proxyReq.on('error', (error) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'content-type': 'text/plain' });
      }
      clientRes.end(`Local Highchair proxy error: ${error.message}`);
    });

    clientReq.on('error', () => {
      proxyReq.destroy();
    });

    clientRes.on('error', () => {
      proxyReq.destroy();
    });

    clientReq.pipe(proxyReq);
  });

  server.on('upgrade', (clientReq, clientSocket, head) => {
    const proxyReq = https.request({
      agent: targetAgent,
      headers: forwardHeaders(clientReq.headers),
      hostname: TARGET_HOST,
      method: clientReq.method,
      path: clientReq.url,
      port: targetPort,
      rejectUnauthorized: false,
    });

    clientSocket.on('error', () => {
      proxyReq.destroy();
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      clientSocket.on('error', () => proxySocket.destroy());
      clientSocket.on('close', () => proxySocket.destroy());
      proxySocket.on('error', () => clientSocket.destroy());
      proxySocket.on('close', () => clientSocket.destroy());

      clientSocket.write(
        `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
        Object.entries(proxyRes.headers)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('\r\n') +
        '\r\n\r\n'
      );

      if (proxyHead.length) {
        clientSocket.write(proxyHead);
      }
      if (head.length) {
        proxySocket.write(head);
      }

      proxySocket.pipe(clientSocket);
      clientSocket.pipe(proxySocket);
    });

    proxyReq.on('response', () => {
      if (clientSocket.writable) {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\nconnection: close\r\ncontent-length: 0\r\n\r\n');
      }
      clientSocket.destroy();
    });

    proxyReq.on('error', () => {
      clientSocket.destroy();
    });

    proxyReq.end();
  });

  server.listen(listenPort, LISTEN_HOST, () => {
    console.log(`Local Highchair proxy (${name}): http/ws://${LISTEN_HOST}:${listenPort} -> https/wss://${TARGET_HOST}:${targetPort}`);
  });

  return server;
}

ROUTES.forEach(createProxy);

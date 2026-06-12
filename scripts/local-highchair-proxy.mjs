// Local dev proxy: browsers reject the Highchair dev server's self-signed
// TLS, so each game mode gets a plain http/ws listener forwarded to its
// https/wss server. Dev-only — never expose this (it disables certificate
// verification and strips transport encryption).
import http from 'node:http';
import https from 'node:https';

const LISTEN_HOST = '127.0.0.1';
const TARGET_HOST = '127.0.0.1';

// listenPort -> game server port
const ROUTES = [
  { name: 'zombies', listenPort: 8081, targetPort: 8080 },
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

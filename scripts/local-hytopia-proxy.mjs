import http from 'node:http';
import https from 'node:https';

const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 8081;
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 8080;

const targetAgent = new https.Agent({
  rejectUnauthorized: false,
});

function forwardHeaders(headers) {
  const copy = { ...headers };
  copy.host = `${TARGET_HOST}:${TARGET_PORT}`;
  return copy;
}

const server = http.createServer((clientReq, clientRes) => {
  const proxyReq = https.request({
    agent: targetAgent,
    headers: forwardHeaders(clientReq.headers),
    hostname: TARGET_HOST,
    method: clientReq.method,
    path: clientReq.url,
    port: TARGET_PORT,
    rejectUnauthorized: false,
  }, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (error) => {
    clientRes.writeHead(502, { 'content-type': 'text/plain' });
    clientRes.end(`Local Hytopia proxy error: ${error.message}`);
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
    port: TARGET_PORT,
    rejectUnauthorized: false,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
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

  proxyReq.on('error', () => {
    clientSocket.destroy();
  });

  proxyReq.end();
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`Local Hytopia proxy: http/ws://${LISTEN_HOST}:${LISTEN_PORT} -> https/wss://${TARGET_HOST}:${TARGET_PORT}`);
});

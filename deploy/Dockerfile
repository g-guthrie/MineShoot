# PvP by Greer — game server image (Fly.io).
#
# Runs two processes, mirroring local dev exactly:
#   - the highchair game server (self-signed https/wss on :8082)
#   - the plain-http proxy in front of it (:8083)
# Fly's edge terminates real TLS and forwards to the proxy, so browsers get
# a valid wss:// endpoint. Model/atlas caches are committed in the repo, so
# boot skips the KTX/gltf-transform toolchain entirely.
FROM node:22-slim

WORKDIR /app
COPY highchair-game/package.json highchair-game/package-lock.json ./highchair-game/
RUN cd highchair-game && npm ci

COPY highchair-game ./highchair-game
COPY scripts/local-highchair-proxy.mjs ./scripts/local-highchair-proxy.mjs
COPY scripts/toktx ./scripts/toktx

ENV NODE_ENV=production \
    PORT=8082 \
    PROXY_LISTEN_HOST=0.0.0.0

EXPOSE 8083

WORKDIR /app/highchair-game
CMD ["/bin/sh", "-c", "PATH=/app/scripts:$PATH ./node_modules/.bin/tsx index.ts & node /app/scripts/local-highchair-proxy.mjs & wait -n"]

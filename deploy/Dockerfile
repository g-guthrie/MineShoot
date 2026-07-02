# PvP by Greer — single-app image (Fly.io): game server + client, one origin.
#
# The proxy serves the built client at / and forwards everything else to the
# highchair game server (self-signed https/wss on :8082, same architecture
# as local dev). Fly's edge terminates real TLS, so players get one URL that
# is both the page and the wss endpoint. Model/atlas caches are committed in
# the repo, so boot skips the KTX/gltf-transform toolchain entirely.

FROM node:22-slim AS client-build
WORKDIR /build
COPY highchair-client/package.json highchair-client/package-lock.json ./
RUN npm ci
COPY highchair-client ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY highchair-game/package.json highchair-game/package-lock.json ./highchair-game/
RUN cd highchair-game && npm ci

COPY highchair-game ./highchair-game
COPY scripts/local-highchair-proxy.mjs ./scripts/local-highchair-proxy.mjs
COPY scripts/toktx ./scripts/toktx
COPY --from=client-build /build/dist ./client-dist

ENV NODE_ENV=production \
    PORT=8082 \
    PROXY_LISTEN_HOST=0.0.0.0 \
    CLIENT_DIST=/app/client-dist

EXPOSE 8083

WORKDIR /app/highchair-game
CMD ["/bin/sh", "-c", "PATH=/app/scripts:$PATH ./node_modules/.bin/tsx index.ts & node /app/scripts/local-highchair-proxy.mjs & wait -n"]

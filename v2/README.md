# PvP V2

This is a ground-up sidecar rebuild of the game. It is intentionally isolated
from the original runtime: no `globalThis.__MAYHEM_RUNTIME`, no mutation of the
current app entrypoints, and no dependency on original gameplay singletons.

## Goals

- Keep the current repo available as an asset and behavior reference.
- Keep V2 ownership explicit: shared simulation, authoritative room, transport,
  client session, rendering, input, and HUD each have one job.
- Make the first slice playable and measurable before expanding scope.
- Keep the server-authoritative shape even for the local sandbox by running a
  room host behind a transport boundary.

## Layout

- `src/shared`: pure game rules, movement, combat, world geometry, math, and
  protocol.
- `src/server`: authoritative room simulation.
- `src/net`: transport boundary. The first adapter is an in-process local
  transport that behaves like a server connection.
- `src/client`: input, client prediction, rendering, HUD, audio, and bootstrap.
- `tests`: focused Node tests for the shared/server contract.

## Local Run

Start Vite from the repo root and open `/v2/`:

```sh
npx vite --host 127.0.0.1 --port 3020
```

Then visit `http://127.0.0.1:3020/v2/`.

## Tests

```sh
node --test v2/tests/*.test.js
```


# Playing locally (zombies-fps)

Two processes: the **game server** (port 8080) and the **engine client**
(port 5173). Run each in its own terminal, or use `./play-zombies.sh`.

## 1. Game server

```bash
cd zombies-game
npm install        # script-free install (.npmrc handles it)
npm start          # patches a dependency quirk, then boots on :8080
```

Wait for `WebServer.start(): Server running on port 8080`.

## 2. Engine client

```bash
cd hytopia-client
npm install
npx vite           # serves the client on :5173
```

## 3. Accept the local certificate (one time)

The game server uses HTTPS with a self-signed certificate. Browsers
refuse it silently until you approve it once:

1. Open **https://127.0.0.1:8080** in a new tab.
2. Click **Advanced → Proceed to 127.0.0.1 (unsafe)**.

## 4. Play

- Open **http://localhost:5173** in Chrome (or any Chromium browser).
- When the connect dialog appears, **leave the field blank** and click
  **OK** — it connects to your local server.
- **Second player:** open another tab (or another browser/machine on
  your LAN) to the same address and do the same. Everyone who joins
  during the 45-second countdown spawns into the round; later joiners
  spectate until the next round.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Could not connect to your local game server" | Server not running, or certificate not accepted yet (step 3) |
| `npm install` fails on native builds | Make sure `.npmrc` exists in the directory (`ignore-scripts=true`) |
| Port 8080 already in use | Another server instance is running — kill it first |
| Black world but HUD visible | Update your graphics drivers / use Chrome on a machine with GPU acceleration enabled (the block textures need GPU texture support; a PNG fallback exists but needs WebGL2) |

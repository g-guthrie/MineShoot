# Going live — PvP by Greer

Two pieces: the **game server** (Fly.io, ~$5/mo) and the **client**
(Cloudflare Pages, free). Players open the Pages URL and are in a match —
no `?join=` needed.

## 1. Game server → Fly.io (one-time setup)

```sh
brew install flyctl        # if needed
fly auth signup            # or: fly auth login
cd /Users/gguthrie/Documents/ShooterFinal
fly launch --copy-config --no-deploy   # accepts fly.toml; pick app name/region
fly deploy
```

The app serves wss at `https://<app-name>.fly.dev` (Fly's edge terminates
real TLS; inside the VM the plain-http proxy fronts the SDK's self-signed
server, same architecture as local dev). Redeploy after changes: `fly deploy`.

## 2. Client → Cloudflare Pages (free)

```sh
cd highchair-client
VITE_PVP_HOST=<app-name>.fly.dev npm run build
npx wrangler login         # first time only
npx wrangler pages deploy dist --project-name pvp-by-greer
```

The printed `*.pages.dev` URL is the game. Instant join is the default;
`?menu=1` shows the mode picker (zombies / custom server), and
`?join=<host>` still overrides everything.

## Notes

- Model/atlas caches are committed, so the server image needs no KTX or
  gltf-transform toolchain — boot is cache-hit only.
- `min_machines_running = 1` and `auto_stop_machines = false` keep the
  match alive; don't let Fly scale the game server to zero.
- Zombies can go live the same way later: second fly app on port 8080's
  stack + a second proxy route.

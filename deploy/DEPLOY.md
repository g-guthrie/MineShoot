# Going live — PeeVeePee

One platform, one app, one URL. The Fly machine runs the game server and
serves the client from the same origin — the page a player loads IS the
server they're playing on, so there is nothing to configure. ~$5/mo.

```sh
brew install flyctl        # if needed
fly auth signup            # or: fly auth login
cd /Users/gguthrie/Documents/ShooterFinal
fly launch --copy-config --no-deploy   # accepts fly.toml; pick app name/region
fly deploy
```

That's it: `https://<app-name>.fly.dev` is the game. Instant join is the
default; `?menu=1` shows the mode picker (zombies / custom server) and
`?join=<host>` overrides the target. Redeploy after changes: `fly deploy`.

## Notes

- Inside the VM: the plain-http proxy (:8083) serves the built client and
  forwards everything else to the SDK's self-signed server (:8082) — the
  exact local-dev architecture. Fly's edge provides the real TLS/wss.
- Model/atlas caches are committed, so the image needs no KTX or
  gltf-transform toolchain — boot is cache-hit only.
- `min_machines_running = 1` + `auto_stop_machines = false` keep matches
  alive; don't let Fly scale the game server to zero.
- Optional later: put the client on a CDN (Cloudflare Pages, free) with
  `VITE_PVP_HOST=<app-name>.fly.dev npm run build` — only worth it if
  first-load speed for far-away players starts to matter.
- Zombies can go live the same way later: a second Fly app running the
  zombies stack with its own proxy route.

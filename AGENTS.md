# Repository Instructions

- After any completed code change, run `npm test`.
- If tests pass, deploy both the Cloudflare Worker and Cloudflare Pages manually with Wrangler before considering the task complete.
- Do not rely on GitHub-triggered deploys for this repository.
- Stable Pages URL: `https://mayhem-9uj.pages.dev/`
- Stable Worker URL: `https://mayhem.gguthrie-minecraft-fps.workers.dev/`
- Worker deploy command: `npx wrangler deploy --config wrangler.toml`
- Frontend architecture rule: keep the menu shell lightweight and load the full game runtime only after the user clicks `PLAY`.
- Pages deploy flow: run `./scripts/stage-pages.sh`, temporarily copy `wrangler.pages.toml` to `wrangler.toml`, run `npx wrangler pages deploy .cf-stage-current --project-name mayhem --branch main --commit-dirty=true`, then restore `wrangler.toml`

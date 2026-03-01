## Multi-Agent Orchestration Policy

For non-trivial requests in this repository, use a quarterback-first workflow.

### Quarterback-first rule
- Delegate to `quarterback` before any write-capable worker starts.
- `quarterback` must run discovery fan-out first, then writer fan-out.
- Writers cannot start until first-wave explorer outputs are available.

### Complexity scoring
Compute task complexity score:
- +1 if expected touched files > 3
- +1 if expected subsystems > 1
- +1 if both investigation and edits are required
- +1 if network/authority contracts are involved

Use adaptive-medium first-wave explorer fan-out:
- score 0-1: 1 explorer
- score 2: 3 explorers
- score 3: 4 explorers
- score 4: 6 explorers

### Nested explorer policy
- Nested explorer fan-out is allowed only if unresolved critical unknowns remain.
- Only `quarterback` may grant nested explorer budget.
- Cap nested explorer additions at 3 per task, launched in +1 increments.

### Writer ownership policy
- Enforce strict file ownership for write-capable workers.
- If two workers need the same file, route that file to `worker` (integrator) only.
- Prefer handoffs over overlapping edits.

### Visibility contract
For each major cycle, include:
- `Dispatch Plan`: phase, launched roles, ownership map, gates.
- `Fanout Telemetry`: launched roles, concurrent peak, active writers, nested explorers used, ownership conflicts.

## Cursor Cloud specific instructions

### Project overview
Minecraft-style browser FPS ("MINESHOOT") — zero-dependency, no-build vanilla JS + Three.js (vendored). No `package.json`, no npm install, no build step.

### Running the game locally
- **Static server**: `python3 -m http.server 8080` (from repo root), then open `http://localhost:8080/`.
- The game auto-detects local mode via the HTTP origin. Click **"Bypass Login (Local Dev)"** on the auth overlay to skip multiplayer auth.
- Multiplayer requires Cloudflare Workers (`npx wrangler dev`), which needs Cloudflare credentials — not needed for local single-player dev/testing.

### Tests
- **Parity harness**: `node scripts/parity-harness.js` — validates spawn safety and schema parity using only Node.js built-ins. This is the only automated test.

### Gotchas
- There is no linter or TypeScript configured; the codebase is vanilla JS with no tooling.
- The `cloudflare/worker.js` uses ES module imports from `../shared/`; do not add CommonJS to shared modules.
- Three.js is vendored at `js/vendor/three.min.js` — do not add it as an npm dependency.
- Pointer lock may not engage in headless/automated browser contexts; the game gracefully falls back to "input capture mode" so gameplay still works.

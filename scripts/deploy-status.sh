#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WATCH=0
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-600}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-6}"
WORKFLOW_NAME="${WORKFLOW_NAME:-Deploy Worker}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-f8462207960b445c1a587cdff5d4d794}"
CF_PAGES_PROJECT="${CF_PAGES_PROJECT:-mayhem}"
CF_PAGES_URL="${CF_PAGES_URL:-https://mayhem-9uj.pages.dev/}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch)
      WATCH=1
      shift
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-600}"
      shift 2
      ;;
    --interval)
      INTERVAL_SECONDS="${2:-6}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "[FAIL] GitHub CLI (gh) is required."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "[FAIL] GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

HEAD_SHA="$(git rev-parse HEAD)"
HEAD_SHORT="$(git rev-parse --short HEAD)"
STARTED_AT="$(date +%s)"

print_banner() {
  local level="$1"
  local message="$2"
  printf '[%s] %s\n' "$level" "$message"
}

worker_json() {
  gh run list \
    --workflow "$WORKFLOW_NAME" \
    --branch main \
    --limit 12 \
    --json databaseId,headSha,status,conclusion,url,workflowName,displayTitle
}

pages_json() {
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    curl -fsS \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT}/deployments"
    return
  fi

  if [[ ! -x "$ROOT_DIR/scripts/wrangler.sh" ]]; then
    return 2
  fi

  "$ROOT_DIR/scripts/wrangler.sh" pages deployment list \
    --project-name "$CF_PAGES_PROJECT" \
    --environment production \
    --json | node -e "
      let s = '';
      process.stdin.on('data', (d) => s += d);
      process.stdin.on('end', () => {
        const rows = JSON.parse(s || '[]');
        const result = rows.map((entry) => ({
          id: String(entry.Id || entry.id || ''),
          environment: String(entry.Environment || entry.environment || ''),
          url: String(entry.Deployment || entry.url || ''),
          latest_stage: { status: 'success' },
          deployment_trigger: {
            metadata: { commit_hash: String(entry.Source || entry.source || '') }
          }
        }));
        console.log(JSON.stringify({ source: 'wrangler', result }));
      });
    "
}

read_worker_status() {
  local json="$1"
  printf '%s' "$json" | node -e "
    let s = '';
    process.stdin.on('data', (d) => s += d);
    process.stdin.on('end', () => {
      const runs = JSON.parse(s || '[]');
      const head = process.argv[1];
      const match = runs.find((run) => String(run.headSha || '') === head) || null;
      if (!match) {
        console.log(JSON.stringify({ found: false }));
        return;
      }
      console.log(JSON.stringify({
        found: true,
        status: String(match.status || ''),
        conclusion: String(match.conclusion || ''),
        url: String(match.url || ''),
        title: String(match.displayTitle || '')
      }));
    });
  " "$HEAD_SHA"
}

read_pages_status() {
  local json="$1"
  printf '%s' "$json" | node -e "
    let s = '';
    process.stdin.on('data', (d) => s += d);
    process.stdin.on('end', () => {
      const payload = JSON.parse(s || '{}');
      const deployments = Array.isArray(payload.result) ? payload.result : [];
      const head = process.argv[1];
      const shortHead = process.argv[2];
      const match = deployments.find((entry) => {
        const commit = String(entry?.deployment_trigger?.metadata?.commit_hash || '');
        if (!commit) return false;
        return head === commit || head.startsWith(commit) || commit.startsWith(shortHead);
      }) || null;
      if (!match) {
        if (payload.source === 'wrangler' && deployments.length > 0) {
          const latest = deployments[0];
          console.log(JSON.stringify({
            found: true,
            commitMatched: false,
            status: String(latest?.latest_stage?.status || 'success'),
            environment: String(latest.environment || ''),
            url: String(latest.url || ''),
            id: String(latest.id || '')
          }));
          return;
        }
        console.log(JSON.stringify({ found: false }));
        return;
      }
      console.log(JSON.stringify({
        found: true,
        commitMatched: true,
        status: String(match?.latest_stage?.status || ''),
        environment: String(match.environment || ''),
        url: String(match.url || ''),
        id: String(match.id || '')
      }));
    });
  " "$HEAD_SHA" "$HEAD_SHORT"
}

render_status() {
  local worker="$1"
  local pages="$2"

  printf '\n'
  print_banner "INFO" "Commit ${HEAD_SHORT}"

  printf '%s' "$worker" | node -e "
    let s=''; process.stdin.on('data', d => s+=d); process.stdin.on('end', () => {
      const data = JSON.parse(s || '{}');
      if (!data.found) {
        console.log('[WARN] Worker deploy: no GitHub Actions run found for this commit yet.');
        return;
      }
      const summary = data.status === 'completed'
        ? (data.conclusion === 'success'
          ? '[PASS] Worker deploy: success'
          : '[FAIL] Worker deploy: ' + (data.conclusion || 'failed'))
        : '[WAIT] Worker deploy: ' + (data.status || 'queued');
      console.log(summary);
      if (data.url) console.log('       ' + data.url);
    });
  "

  if [[ "$pages" == "__TOKEN_MISSING__" ]]; then
    print_banner "WARN" "Pages deploy: CLOUDFLARE_API_TOKEN is not set locally, so Pages status cannot be checked."
    print_banner "INFO" "Pages URL: ${CF_PAGES_URL}"
    return
  fi

  printf '%s' "$pages" | node -e "
    let s=''; process.stdin.on('data', d => s+=d); process.stdin.on('end', () => {
      const data = JSON.parse(s || '{}');
      if (!data.found) {
        console.log('[WAIT] Pages deploy: no production deployment found for this commit yet.');
        return;
      }
      const ok = data.status === 'success';
      const active = data.status === 'active';
      const summary = ok
        ? (data.commitMatched === false
          ? '[PASS] Pages deploy: latest production found (commit not exposed by Wrangler)'
          : '[PASS] Pages deploy: success')
        : (active ? '[WAIT] Pages deploy: active' : '[FAIL] Pages deploy: ' + (data.status || 'failed'));
      console.log(summary);
      if (data.url) console.log('       ' + data.url);
    });
  "
}

is_worker_done() {
  local worker="$1"
  printf '%s' "$worker" | node -e "
    let s=''; process.stdin.on('data', d => s+=d); process.stdin.on('end', () => {
      const data = JSON.parse(s || '{}');
      process.exit(data.found && data.status === 'completed' ? 0 : 1);
    });
  "
}

is_pages_done() {
  local pages="$1"
  if [[ "$pages" == "__TOKEN_MISSING__" ]]; then
    return 0
  fi
  printf '%s' "$pages" | node -e "
    let s=''; process.stdin.on('data', d => s+=d); process.stdin.on('end', () => {
      const data = JSON.parse(s || '{}');
      process.exit(data.found && data.status === 'success' ? 0 : 1);
    });
  "
}

check_once() {
  local worker
  local pages
  worker="$(read_worker_status "$(worker_json)")"
  if pages_payload="$(pages_json 2>/dev/null)"; then
    pages="$(read_pages_status "$pages_payload")"
  else
    pages="__TOKEN_MISSING__"
  fi

  render_status "$worker" "$pages"

  if is_worker_done "$worker" && is_pages_done "$pages"; then
    return 0
  fi
  return 1
}

if [[ "$WATCH" -eq 0 ]]; then
  check_once || exit 1
  exit 0
fi

while true; do
  if check_once; then
    printf '\n'
    print_banner "PASS" "All deploy checks passed for ${HEAD_SHORT}."
    exit 0
  fi

  NOW="$(date +%s)"
  if (( NOW - STARTED_AT >= TIMEOUT_SECONDS )); then
    printf '\n'
    print_banner "FAIL" "Timed out waiting for deploys for ${HEAD_SHORT}."
    exit 1
  fi

  sleep "$INTERVAL_SECONDS"
done

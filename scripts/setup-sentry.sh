#!/usr/bin/env bash
# One-time Sentry setup for the public preview (docs/MONITORING.md).
# Creates the canal-recall and map-quest projects in org whizziwig, reads
# their DSNs, and stores them plus an auth token as GitHub Actions secrets.
# Safe to re-run: existing projects are reused.
set -euo pipefail

ORG=whizziwig
SENTRY="npx --yes sentry@latest"

command -v gh >/dev/null || { echo "Needs the GitHub CLI (gh)."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run 'gh auth login' first."; exit 1; }

if ! $SENTRY auth whoami >/dev/null 2>&1; then
  echo "== Sentry login (opens a browser)"
  $SENTRY auth login
fi
$SENTRY auth whoami >/dev/null || { echo "Sentry login failed."; exit 1; }

# Print the first DSN-looking string anywhere in a JSON document.
dsn_from_json() {
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const walk = v => {
        if (typeof v === "string") return /^https:\/\/[^@\s]+@[^\s]+\/\d+$/.test(v) ? v : null;
        if (v && typeof v === "object") for (const x of Object.values(v)) { const r = walk(x); if (r) return r; }
        return null;
      };
      try { const r = walk(JSON.parse(s)); if (r) console.log(r); } catch {}
    });'
}

project_dsn() {
  local slug=$1 dsn
  dsn=$($SENTRY project view "$ORG/$slug" --json 2>/dev/null | dsn_from_json || true)
  if [ -z "$dsn" ]; then
    dsn=$($SENTRY dsn list "$ORG/$slug" 2>/dev/null | grep -Eo 'https://[^@[:space:]]+@[^[:space:]]+/[0-9]+' | head -1 || true)
  fi
  if [ -z "$dsn" ]; then
    dsn=$($SENTRY project view "$ORG/$slug" 2>/dev/null | grep -Eo 'https://[^@[:space:]]+@[^[:space:]]+/[0-9]+' | head -1 || true)
  fi
  echo "$dsn"
}

ensure_project() {
  local slug=$1 platform=$2
  if $SENTRY project view "$ORG/$slug" >/dev/null 2>&1; then
    echo "== $ORG/$slug exists"
  else
    echo "== creating $ORG/$slug ($platform)"
    $SENTRY project create "$ORG/$slug:$platform"
  fi
}

ensure_project canal-recall javascript
ensure_project map-quest javascript-react

set_dsn_secret() {
  local slug=$1 secret=$2 dsn
  dsn=$(project_dsn "$slug")
  if [ -z "$dsn" ]; then
    echo "Could not read the $slug DSN automatically."
    echo "Copy it from https://$ORG.sentry.io/settings/projects/$slug/keys/ and paste it here:"
    read -r dsn
  fi
  printf '%s' "$dsn" | gh secret set "$secret"
  echo "== $secret set ($slug)"
}

set_dsn_secret canal-recall SENTRY_DSN
set_dsn_secret map-quest SENTRY_DSN_MAP_QUEST

echo
echo "== Auth token for source-map upload"
echo "Create an org auth token with scope project:releases at:"
echo "   https://$ORG.sentry.io/settings/auth-tokens/"
echo "Paste it here (input hidden):"
read -rs token
echo
[ -n "$token" ] && printf '%s' "$token" | gh secret set SENTRY_AUTH_TOKEN && echo "== SENTRY_AUTH_TOKEN set"

echo
gh secret list | grep -E 'SENTRY' || true
echo "Done. The next push to main turns Sentry on."

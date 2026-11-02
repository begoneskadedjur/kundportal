#!/usr/bin/env sh
# Kör cron-vs-plan.mts för ett eller flera datum med service role ur .env.
#   sh scripts/regression/cron-vs-plan.sh <utmapp> [datum ...]
# Utan datum: dagens datum.
set -e
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
export VITE_SUPABASE_ANON_KEY="$SUPABASE_SERVICE_ROLE_KEY" VITE_SUPABASE_URL="$SUPABASE_URL"
out="$1"; shift
mkdir -p "$out"
status=0
if [ $# -eq 0 ]; then
  npx vite-node scripts/regression/cron-vs-plan.mts -- --out="$out/idag.json" || status=1
fi
for d in "$@"; do
  npx vite-node scripts/regression/cron-vs-plan.mts -- --today="$d" --out="$out/$d.json" || status=1
done
exit $status

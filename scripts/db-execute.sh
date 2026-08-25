#!/usr/bin/env bash
# Apply migration SQL files to the linked Supabase project.
#
# Reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from .env.local
# (or from the environment, which wins). Uses the same Management API
# endpoint the dashboard SQL editor uses, so no `supabase link` needed.
#
# Usage:
#   npm run db:execute -- supabase/migration-24-post-due-times.sql
#   npm run db:execute -- supabase/migration-26-subject-rename.sql supabase/migration-27-foo.sql
set -euo pipefail

# Prefer the environment, fall back to .env.local (project root).
ENV_FILE="$(dirname "$0")/../.env.local"
if [[ -f "$ENV_FILE" ]]; then
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    SUPABASE_ACCESS_TOKEN="$(grep -E '^SUPABASE_ACCESS_TOKEN=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
  fi
  if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    SUPABASE_PROJECT_REF="$(grep -E '^SUPABASE_PROJECT_REF=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
  fi
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is not set. Add it to .env.local or export it." >&2
  exit 1
fi
if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_PROJECT_REF is not set. Add it to .env.local or export it." >&2
  exit 1
fi
if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <migration.sql> [more-migrations.sql ...]" >&2
  exit 1
fi

for file in "$@"; do
  if [[ ! -f "$file" ]]; then
    echo "File not found: $file" >&2
    exit 1
  fi

  echo "Applying $file ..."
  node -e "process.stdout.write(JSON.stringify({ query: require('fs').readFileSync(process.argv[1], 'utf8') }))" "$file" \
    > /tmp/db-execute-payload.json

  RESPONSE="$(curl -s --max-time 60 -X POST \
    "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary @/tmp/db-execute-payload.json)"

  if echo "$RESPONSE" | grep -q '"message"'; then
    echo "ERROR while applying $file:" >&2
    echo "$RESPONSE" >&2
    exit 1
  fi
  echo "  done."
done

echo "All migrations applied."

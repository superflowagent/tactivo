#!/usr/bin/env bash
# Apply Supabase secrets from .env.local (Unix / Bash)
# Usage: ./scripts/apply-secrets.sh
set -euo pipefail
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo ".env.local not found" >&2
  exit 1
fi
ALLOWED=("ADMIN_SECRET" "SUPABASE_SERVICE_ROLE_KEY" "SUPABASE_ANON_KEY" "APP_URL" "SUPABASE_DB_URL" "SUPABASE_URL")
while IFS= read -r line || [ -n "$line" ]; do
  line="${line##+([[:space:]])}"
  line="${line%%+([[:space:]])}"
  [[ -z "$line" ]] && continue
  [[ "$line" == \#* ]] && continue
  if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    for allowed in "${ALLOWED[@]}"; do
      if [[ "$key" == "$allowed" ]]; then
        echo "Setting secret: $key"
        supabase secrets set "$key=$val" >/dev/null
      fi
    done
  fi
done < "$ENV_FILE"

echo "Secrets applied (if present)."
#!/usr/bin/env bash
# Ensure ADMIN_SECRET from .env.local is present in public.app_settings (Unix / Bash)
# Usage: ./scripts/ensure-secret-in-db.sh
set -euo pipefail
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo ".env.local not found" >&2
  exit 1
fi
ADMIN=$(grep -E '^\s*ADMIN_SECRET\s*=' "$ENV_FILE" | sed -E 's/^\s*ADMIN_SECRET\s*=\s*//')
if [ -z "$ADMIN" ]; then
  echo "ADMIN_SECRET not found in $ENV_FILE" >&2
  exit 1
fi
# Use $$ quoting in psql to safely insert
docker exec supabase_db_tactivo-supabase psql -U postgres -c "INSERT INTO public.app_settings (key, value) VALUES ('ADMIN_SECRET', $$${ADMIN}$$) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
echo "ADMIN_SECRET upserted into public.app_settings (local DB)."
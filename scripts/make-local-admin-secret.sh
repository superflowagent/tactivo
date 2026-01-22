#!/usr/bin/env bash
# Create .local_admin_secret from .env.local (Unix)
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
echo -n "$ADMIN" > .local_admin_secret
echo ".local_admin_secret created"
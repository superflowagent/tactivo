BEGIN;

-- 20260122143000_create_app_settings.sql
-- Add simple key/value store for environment-like settings that may be read by
-- functions when env variables are not available (useful for controlled fallback).
-- NOTE: Do NOT store production secrets here unless you explicitly want them in DB.
-- Prefer `supabase secrets set` for production secrets.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text
);

COMMIT;

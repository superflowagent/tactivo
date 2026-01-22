BEGIN;

-- Simple key/value table for local configuration; values are stored as text and intended
-- to be managed by service-role authenticated scripts.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text
);

COMMIT;

-- Baseline migration generated on 2026-01-22
-- Exact snapshot of local Supabase schema with manual fixes:
--  - DROP TABLE IF EXISTS public.app_settings CASCADE;
--  - ALTER TABLE public.profiles DROP COLUMN IF EXISTS test_temp;
-- Apply this single migration to bring remote schema to the local state.

BEGIN;

-- Ensure any legacy app_settings table is removed (was present in prod before)
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- Remove legacy debug/test column from profiles if present
ALTER TABLE public.profiles DROP COLUMN IF EXISTS test_temp;

COMMIT;

-- The rest of the schema is the canonical snapshot (from 20260121222426_remote_schema.sql)

-- START OF SCHEMA SNAPSHOT

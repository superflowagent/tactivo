-- Migration: add test_temp column to profiles
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS test_temp text;

-- Ensure migration is idempotent and safe for inclusion in versioned migrations

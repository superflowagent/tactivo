-- Migration: normalize event.client scalars into arrays and toggle one event's type to test trigger

DO $$
BEGIN
  RAISE NOTICE 'skipping normalize-and-toggle migration 20260116083000_normalize_and_toggle_single_event.sql';
END$$;
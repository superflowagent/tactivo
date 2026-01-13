-- Migration: fix naive (timestamp without time zone) datetimes in events table
-- This migration converts only rows where the column type is "timestamp without time zone"
-- to timestamptz by casting the textual representation. It is idempotent: subsequent runs
-- will not affect already-timestamptz rows.

BEGIN;

-- Create a temporary table listing rows that will be changed (for visibility)
CREATE TEMP TABLE IF NOT EXISTS _to_update_events AS
SELECT id, datetime
FROM events
WHERE pg_typeof(datetime)::text = 'timestamp without time zone' AND datetime IS NOT NULL;

-- Do the safe conversion using textual cast to timestamptz
UPDATE events e
SET datetime = (e.datetime::text)::timestamptz
FROM _to_update_events t
WHERE e.id = t.id;

-- Cleanup temp table (optional - will be dropped at session end)
DROP TABLE IF EXISTS _to_update_events;

COMMIT;

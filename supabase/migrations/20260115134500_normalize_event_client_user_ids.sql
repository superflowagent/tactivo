-- Migration: normalize events.client values to use profile.id (not profile.user)
-- This replaces client uuids that are actually profile.user with the corresponding profile.id

BEGIN;

-- Build a mapping of event id -> normalized client array
WITH evt_clients AS (
  SELECT
    e.id AS event_id,
    array_agg(distinct CASE
      WHEN p_id.id IS NOT NULL THEN p_id.id
      WHEN p_user.id IS NOT NULL THEN p_user.id
      ELSE NULL
    END) FILTER (WHERE CASE
      WHEN p_id.id IS NOT NULL THEN TRUE
      WHEN p_user.id IS NOT NULL THEN TRUE
      ELSE FALSE END) AS normalized_clients
  FROM public.events e
  CROSS JOIN LATERAL (
    SELECT unnest(as_uuid_array(e.client)) AS client_id
  ) c
  LEFT JOIN public.profiles p_id ON p_id.id = c.client_id
  LEFT JOIN public.profiles p_user ON p_user.user = c.client_id
  GROUP BY e.id
)
-- Update events with a normalized client array when mapping found
UPDATE public.events e
SET client = ec.normalized_clients
FROM evt_clients ec
WHERE e.id = ec.event_id
  AND ec.normalized_clients IS NOT NULL
  AND e.client IS NOT NULL;

COMMIT;

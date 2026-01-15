-- Migration: test trigger adjust_class_credits behavior (class->appointment and appointment->class)
-- Creates a results table and runs the scenario so we can inspect outcomes in DB dumps

BEGIN;

CREATE TABLE IF NOT EXISTS public.adjust_class_credits_test_results (
  id bigserial PRIMARY KEY,
  event_id uuid,
  profile_id uuid,
  step text,
  class_credits_after int,
  audit_count int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create a test profile with 0 credits (allowed to go negative)
WITH p AS (
  INSERT INTO public.profiles (id, "user", company, role, name, class_credits)
  VALUES (gen_random_uuid(), gen_random_uuid(), (SELECT id FROM public.companies LIMIT 1), 'client', 'Test Trigger Profile', 0)
  RETURNING id
), e AS (
  -- Create an event of type 'class' with the test profile
  INSERT INTO public.events (id, type, datetime, client, company)
  VALUES (gen_random_uuid(), 'class', now(), (SELECT array[id] FROM p), (SELECT id FROM public.companies LIMIT 1))
  RETURNING id, type, client
)
-- Record initial state
INSERT INTO public.adjust_class_credits_test_results (event_id, profile_id, step, class_credits_after, audit_count)
SELECT
  e.id AS event_id,
  p.id AS profile_id,
  'initial_after_create_class' AS step,
  (SELECT class_credits FROM public.profiles WHERE id = p.id) AS class_credits_after,
  (SELECT COUNT(*) FROM public.adjust_class_credits_audit WHERE client_uuids @> (SELECT array[id] FROM p)) AS audit_count
FROM e, p;

-- Change event to appointment (class -> appointment) -> should REFUND +1
UPDATE public.events SET type = 'appointment' WHERE id = (SELECT id FROM e);

INSERT INTO public.adjust_class_credits_test_results (event_id, profile_id, step, class_credits_after, audit_count)
SELECT
  e.id AS event_id,
  p.id AS profile_id,
  'after_class_to_appointment' AS step,
  (SELECT class_credits FROM public.profiles WHERE id = p.id) AS class_credits_after,
  (SELECT COUNT(*) FROM public.adjust_class_credits_audit WHERE op = 'type-change-refund' AND client_uuids @> (SELECT array[id] FROM p)) AS audit_count
FROM e, p;

-- Change event back to class (appointment -> class) -> should DEDUCT -1
UPDATE public.events SET type = 'class' WHERE id = (SELECT id FROM e);

INSERT INTO public.adjust_class_credits_test_results (event_id, profile_id, step, class_credits_after, audit_count)
SELECT
  e.id AS event_id,
  p.id AS profile_id,
  'after_appointment_to_class' AS step,
  (SELECT class_credits FROM public.profiles WHERE id = p.id) AS class_credits_after,
  (SELECT COUNT(*) FROM public.adjust_class_credits_audit WHERE op = 'type-change-deduct' AND client_uuids @> (SELECT array[id] FROM p)) AS audit_count
FROM e, p;

COMMIT;
-- Migration: Mark test users as email-confirmed so verification scripts can sign in

BEGIN;

-- Replace the IDs with the test users created during verification
-- (these are safe to hardcode for test-only migrations)
UPDATE auth.users
SET email_confirmed_at = now()
WHERE id IN ('6b5373ad-4100-41d3-b807-f02c2a0f2640', '0c5f4a73-5d8d-4186-ba3e-3d1e573139ef');

-- Ensure identity_data.email_verified = true for email provider identities
UPDATE auth.identities
SET identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb, true)
WHERE user_id IN ('6b5373ad-4100-41d3-b807-f02c2a0f2640', '0c5f4a73-5d8d-4186-ba3e-3d1e573139ef')
  AND provider = 'email';

COMMIT;

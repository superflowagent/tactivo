-- Migration: fill profiles with fake address/occupation/sport/history/diagnosis/notes/allergies and random credits
-- Date: 2025-12-30

BEGIN;

-- Backup
CREATE TABLE IF NOT EXISTS public.profiles_backup_20251230 AS SELECT * FROM public.profiles;

-- Update only rows that have NULLs in any of the target columns
UPDATE public.profiles
SET
  address = COALESCE(address, (ARRAY[
    'Calle Falsa 123', 'Av. Libertador 215', 'Calle San Martín 45', 'Calle 9 de Julio 100',
    'Av. Corrientes 202', 'Paseo Colón 300', 'Calle Luna 7', 'Calle Sol 9'
  ])[(floor(random()*8)::int + 1)]),
  occupation = COALESCE(occupation, (ARRAY[
    'Profesor', 'Entrenador', 'Estudiante', 'Programador', 'Médico', 'Abogado', 'Recepcionista', 'Administrador'
  ])[(floor(random()*8)::int + 1)]),
  sport = COALESCE(sport, (ARRAY[
    'Running', 'Yoga', 'Crossfit', 'Natación', 'Ciclismo', 'Fútbol', 'Pilates', 'Boxeo'
  ])[(floor(random()*8)::int + 1)]),
  history = COALESCE(history, (ARRAY[
    'No significant medical history', 'Previous knee surgery in 2019', 'Allergic to penicillin',
    'Regular gym-goer for 5 years', 'Recovering from shoulder injury', 'Has asthma (mild)',
    'No prior injuries', 'Recently started strength training'
  ])[(floor(random()*8)::int + 1)]),
  diagnosis = COALESCE(diagnosis, (ARRAY[
    'Healthy', 'Lower back pain', 'Rotator cuff tendinopathy', 'Patellofemoral pain',
    'Hypertension', 'Mild asthma', 'Tendinitis', 'Ankle sprain'
  ])[(floor(random()*8)::int + 1)]),
  notes = COALESCE(notes, (ARRAY[
    'Prefers morning sessions', 'Requires modifications for knee pain', 'Likes HIIT',
    'Prefers one-on-one', 'Bring water bottle', 'Check blood pressure before session',
    'Follow-up in 2 weeks', 'Monitor exertion levels'
  ])[(floor(random()*8)::int + 1)]),
  allergies = COALESCE(allergies, (ARRAY[
    'None', 'Penicillin', 'Peanuts', 'Gluten', 'Latex', 'Seafood', 'Dust', 'Pollen'
  ])[(floor(random()*8)::int + 1)]),
  class_credits = COALESCE(class_credits, (floor(random() * 41))::int),
  session_credits = COALESCE(session_credits, (floor(random() * 41))::int)
WHERE
  address IS NULL OR occupation IS NULL OR sport IS NULL OR history IS NULL OR diagnosis IS NULL OR notes IS NULL OR allergies IS NULL OR class_credits IS NULL OR session_credits IS NULL;

-- 2) Create an auth.user for each profile without a linked user
--    Emails are synthetic and include the profile id so we avoid collisions
INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, created_at, raw_app_meta_data, raw_user_meta_data)
SELECT
  gen_random_uuid() AS id,
  ('no-reply+' || p.id::text || '@seed.local')::text AS email,
  'authenticated' AS aud,
  COALESCE(p.role, 'user') AS role,
  now() AS email_confirmed_at,
  now() AS created_at,
  '{}'::jsonb AS raw_app_meta_data,
  jsonb_build_object('profile_id', p.id::text, 'name', p.name) AS raw_user_meta_data
FROM public.profiles p
WHERE p."user" IS NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = ('no-reply+' || p.id::text || '@seed.local')::text);

-- 3) Link the newly created users to the profiles
UPDATE public.profiles p
SET "user" = u.id
FROM auth.users u
WHERE p."user" IS NULL
  AND u.email = ('no-reply+' || p.id::text || '@seed.local')::text;

-- 4) Ensure auth.users.role matches the profile role
UPDATE auth.users u
SET role = p.role
FROM public.profiles p
WHERE p."user" = u.id
  AND u.role IS DISTINCT FROM p.role;

COMMIT;

-- Quick checks
-- SELECT id, name, address, occupation, sport, class_credits, session_credits FROM public.profiles LIMIT 20;
-- SELECT count(*) FROM public.profiles WHERE address IS NULL OR occupation IS NULL OR class_credits IS NULL;

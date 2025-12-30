-- Seed script for Supabase schema
-- - Converts events.client and events.professional to uuid[]
-- - Creates 2 companies, users, profiles (3 clients + 2 professionals per company)
-- - Creates equipment and anatomy for each company
-- - Creates 5 exercises per company each with 2 equipment and 2 anatomy
-- - Creates 5 events per company this week assigning clients and professionals

BEGIN;

-- Ensure gen_random_uuid() is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Convert events.client and events.professional to uuid[] (safe for empty tables)
ALTER TABLE public.events DROP COLUMN IF EXISTS client;
ALTER TABLE public.events DROP COLUMN IF EXISTS professional;
ALTER TABLE public.events ADD COLUMN client uuid[] DEFAULT '{}'::uuid[];
ALTER TABLE public.events ADD COLUMN professional uuid[] DEFAULT '{}'::uuid[];

-- 2) Insert companies
INSERT INTO public.companies (id, name, created, domain, open_time, close_time, default_appointment_duration, default_class_duration)
VALUES
  (gen_random_uuid(), 'Alpha Fitness', now(),'alpha.example','08:00','20:00', 30, 60),
  (gen_random_uuid(), 'Beta Gym', now(),'beta.example','09:00','18:00', 30, 60);

-- 3) Create auth.users entries for the profiles (minimal fields)
-- NOTE: if your auth.users has additional NOT NULL columns you may need to adapt these inserts
INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, created_at, raw_app_meta_data, user_metadata)
VALUES
  (gen_random_uuid(), 'alpha.client1@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'alpha.client2@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'alpha.client3@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'alpha.prof1@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'alpha.prof2@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'beta.client1@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'beta.client2@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'beta.client3@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'beta.prof1@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), 'beta.prof2@example.com', 'authenticated', 'user', now(), now(), '{}'::jsonb, '{}'::jsonb)
;

-- 4) Create profiles for each user and attach to the appropriate company
-- Alpha profiles
INSERT INTO public.profiles (id, name, created, last_name, role, company, phone, "user")
VALUES
  (gen_random_uuid(), 'Alpha Client 1', now(), 'Client', 'client', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness'), '555-0101', (SELECT id FROM auth.users WHERE email = 'alpha.client1@example.com')),
  (gen_random_uuid(), 'Alpha Client 2', now(), 'Client', 'client', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness'), '555-0102', (SELECT id FROM auth.users WHERE email = 'alpha.client2@example.com')),
  (gen_random_uuid(), 'Alpha Client 3', now(), 'Client', 'client', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness'), '555-0103', (SELECT id FROM auth.users WHERE email = 'alpha.client3@example.com')),
  (gen_random_uuid(), 'Alpha Prof 1', now(), 'Professional', 'professional', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness'), '555-0111', (SELECT id FROM auth.users WHERE email = 'alpha.prof1@example.com')),
  (gen_random_uuid(), 'Alpha Prof 2', now(), 'Professional', 'professional', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness'), '555-0112', (SELECT id FROM auth.users WHERE email = 'alpha.prof2@example.com'))
;

-- Beta profiles
INSERT INTO public.profiles (id, name, created, last_name, role, company, phone, "user")
VALUES
  (gen_random_uuid(), 'Beta Client 1', now(), 'Client', 'client', (SELECT id FROM public.companies WHERE name = 'Beta Gym'), '555-0201', (SELECT id FROM auth.users WHERE email = 'beta.client1@example.com')),
  (gen_random_uuid(), 'Beta Client 2', now(), 'Client', 'client', (SELECT id FROM public.companies WHERE name = 'Beta Gym'), '555-0202', (SELECT id FROM auth.users WHERE email = 'beta.client2@example.com')),
  (gen_random_uuid(), 'Beta Client 3', now(), 'Client', 'client', (SELECT id FROM public.companies WHERE name = 'Beta Gym'), '555-0203', (SELECT id FROM auth.users WHERE email = 'beta.client3@example.com')),
  (gen_random_uuid(), 'Beta Prof 1', now(), 'Professional', 'professional', (SELECT id FROM public.companies WHERE name = 'Beta Gym'), '555-0211', (SELECT id FROM auth.users WHERE email = 'beta.prof1@example.com')),
  (gen_random_uuid(), 'Beta Prof 2', now(), 'Professional', 'professional', (SELECT id FROM public.companies WHERE name = 'Beta Gym'), '555-0212', (SELECT id FROM auth.users WHERE email = 'beta.prof2@example.com'))
;

-- 5) Create 5 equipment and 5 anatomy entries per company
-- Alpha equipment
INSERT INTO public.equipment (id, name, created, description, company)
VALUES
  (gen_random_uuid(), 'Dumbbell 1 (Alpha)', now(), 'Standard dumbbell', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Dumbbell 2 (Alpha)', now(), 'Standard dumbbell', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Kettlebell 1 (Alpha)', now(), 'Kettlebell', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Barbell 1 (Alpha)', now(), 'Barbell', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Mat 1 (Alpha)', now(), 'Yoga mat', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness'))
;

-- Alpha anatomy
INSERT INTO public.anatomy (id, name, created, description, company)
VALUES
  (gen_random_uuid(), 'Chest (Alpha)', now(), 'Pectoral region', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Back (Alpha)', now(), 'Dorsal region', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Legs (Alpha)', now(), 'Lower limbs', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Shoulder (Alpha)', now(), 'Deltoid region', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness')),
  (gen_random_uuid(), 'Arm (Alpha)', now(), 'Biceps/triceps', (SELECT id FROM public.companies WHERE name = 'Alpha Fitness'))
;

-- Beta equipment
INSERT INTO public.equipment (id, name, created, description, company)
VALUES
  (gen_random_uuid(), 'Dumbbell 1 (Beta)', now(), 'Standard dumbbell', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Dumbbell 2 (Beta)', now(), 'Standard dumbbell', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Kettlebell 1 (Beta)', now(), 'Kettlebell', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Barbell 1 (Beta)', now(), 'Barbell', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Mat 1 (Beta)', now(), 'Yoga mat', (SELECT id FROM public.companies WHERE name = 'Beta Gym'))
;

-- Beta anatomy
INSERT INTO public.anatomy (id, name, created, description, company)
VALUES
  (gen_random_uuid(), 'Chest (Beta)', now(), 'Pectoral region', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Back (Beta)', now(), 'Dorsal region', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Legs (Beta)', now(), 'Lower limbs', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Shoulder (Beta)', now(), 'Deltoid region', (SELECT id FROM public.companies WHERE name = 'Beta Gym')),
  (gen_random_uuid(), 'Arm (Beta)', now(), 'Biceps/triceps', (SELECT id FROM public.companies WHERE name = 'Beta Gym'))
;

-- 6) Create 5 exercises per company, each referencing 2 equipment and 2 anatomy
-- Alpha exercises
INSERT INTO public.exercises (id, name, created, company, equipment, anatomy, description)
VALUES
  (gen_random_uuid(), 'Alpha Exercise 1', now(), (SELECT id FROM public.companies WHERE name='Alpha Fitness'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Dumbbell 1 (Alpha)'), (SELECT id FROM public.equipment WHERE name='Dumbbell 2 (Alpha)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Chest (Alpha)'), (SELECT id FROM public.anatomy WHERE name='Arm (Alpha)')]::uuid[], 'Bench & curls'),
  (gen_random_uuid(), 'Alpha Exercise 2', now(), (SELECT id FROM public.companies WHERE name='Alpha Fitness'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Kettlebell 1 (Alpha)'), (SELECT id FROM public.equipment WHERE name='Mat 1 (Alpha)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Legs (Alpha)'), (SELECT id FROM public.anatomy WHERE name='Back (Alpha)')]::uuid[], 'Kettlebell swings & mat work'),
  (gen_random_uuid(), 'Alpha Exercise 3', now(), (SELECT id FROM public.companies WHERE name='Alpha Fitness'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Barbell 1 (Alpha)'), (SELECT id FROM public.equipment WHERE name='Dumbbell 1 (Alpha)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Back (Alpha)'), (SELECT id FROM public.anatomy WHERE name='Shoulder (Alpha)')]::uuid[], 'Barbell & shoulder presses'),
  (gen_random_uuid(), 'Alpha Exercise 4', now(), (SELECT id FROM public.companies WHERE name='Alpha Fitness'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Mat 1 (Alpha)'), (SELECT id FROM public.equipment WHERE name='Dumbbell 2 (Alpha)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Legs (Alpha)'), (SELECT id FROM public.anatomy WHERE name='Chest (Alpha)')]::uuid[], 'Core & legs'),
  (gen_random_uuid(), 'Alpha Exercise 5', now(), (SELECT id FROM public.companies WHERE name='Alpha Fitness'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Barbell 1 (Alpha)'), (SELECT id FROM public.equipment WHERE name='Mat 1 (Alpha)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Shoulder (Alpha)'), (SELECT id FROM public.anatomy WHERE name='Arm (Alpha)')]::uuid[], 'Complex lifts')
;

-- Beta exercises
INSERT INTO public.exercises (id, name, created, company, equipment, anatomy, description)
VALUES
  (gen_random_uuid(), 'Beta Exercise 1', now(), (SELECT id FROM public.companies WHERE name='Beta Gym'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Dumbbell 1 (Beta)'), (SELECT id FROM public.equipment WHERE name='Dumbbell 2 (Beta)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Chest (Beta)'), (SELECT id FROM public.anatomy WHERE name='Arm (Beta)')]::uuid[], 'Bench & curls'),
  (gen_random_uuid(), 'Beta Exercise 2', now(), (SELECT id FROM public.companies WHERE name='Beta Gym'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Kettlebell 1 (Beta)'), (SELECT id FROM public.equipment WHERE name='Mat 1 (Beta)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Legs (Beta)'), (SELECT id FROM public.anatomy WHERE name='Back (Beta)')]::uuid[], 'Kettlebell swings & mat work'),
  (gen_random_uuid(), 'Beta Exercise 3', now(), (SELECT id FROM public.companies WHERE name='Beta Gym'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Barbell 1 (Beta)'), (SELECT id FROM public.equipment WHERE name='Dumbbell 1 (Beta)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Back (Beta)'), (SELECT id FROM public.anatomy WHERE name='Shoulder (Beta)')]::uuid[], 'Barbell & shoulder presses'),
  (gen_random_uuid(), 'Beta Exercise 4', now(), (SELECT id FROM public.companies WHERE name='Beta Gym'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Mat 1 (Beta)'), (SELECT id FROM public.equipment WHERE name='Dumbbell 2 (Beta)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Legs (Beta)'), (SELECT id FROM public.anatomy WHERE name='Chest (Beta)')]::uuid[], 'Core & legs'),
  (gen_random_uuid(), 'Beta Exercise 5', now(), (SELECT id FROM public.companies WHERE name='Beta Gym'),
    ARRAY[(SELECT id FROM public.equipment WHERE name='Barbell 1 (Beta)'), (SELECT id FROM public.equipment WHERE name='Mat 1 (Beta)')]::uuid[],
    ARRAY[(SELECT id FROM public.anatomy WHERE name='Shoulder (Beta)'), (SELECT id FROM public.anatomy WHERE name='Arm (Beta)')]::uuid[], 'Complex lifts')
;

-- 7) Create 5 events per company (this week), assign few clients and professionals
-- Alpha events (using now() + n days)
INSERT INTO public.events (id, type, datetime, created, duration, client, professional, cost, paid, notes, company)
VALUES
  (gen_random_uuid(), 'class', now() + interval '1 day' + interval '10 hours', now(), 60,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Client 1' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness')),(SELECT id FROM public.profiles WHERE name='Alpha Client 2' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Prof 1' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[], 30, false, 'Morning class', (SELECT id FROM public.companies WHERE name='Alpha Fitness')),
  (gen_random_uuid(), 'session', now() + interval '2 day' + interval '12 hours', now(), 45,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Client 3' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Prof 2' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[], 40, true, 'One-on-one session', (SELECT id FROM public.companies WHERE name='Alpha Fitness')),
  (gen_random_uuid(), 'class', now() + interval '3 day' + interval '09 hours', now(), 50,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Client 1' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness')),(SELECT id FROM public.profiles WHERE name='Alpha Client 3' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Prof 1' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness')),(SELECT id FROM public.profiles WHERE name='Alpha Prof 2' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[], 25, false, 'Group training', (SELECT id FROM public.companies WHERE name='Alpha Fitness')),
  (gen_random_uuid(), 'session', now() + interval '4 day' + interval '11 hours', now(), 30,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Client 2' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Prof 1' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[], 20, false, 'Quick check-in', (SELECT id FROM public.companies WHERE name='Alpha Fitness')),
  (gen_random_uuid(), 'class', now() + interval '5 day' + interval '18 hours', now(), 60,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Client 1' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness')),(SELECT id FROM public.profiles WHERE name='Alpha Client 2' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness')),(SELECT id FROM public.profiles WHERE name='Alpha Client 3' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Alpha Prof 2' AND company=(SELECT id FROM public.companies WHERE name='Alpha Fitness'))]::uuid[], 35, true, 'Evening group', (SELECT id FROM public.companies WHERE name='Alpha Fitness'))
;

-- Beta events
INSERT INTO public.events (id, type, datetime, created, duration, client, professional, cost, paid, notes, company)
VALUES
  (gen_random_uuid(), 'class', now() + interval '1 day' + interval '09 hours', now(), 60,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Client 1' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym')),(SELECT id FROM public.profiles WHERE name='Beta Client 2' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Prof 1' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[], 30, false, 'Morning class', (SELECT id FROM public.companies WHERE name='Beta Gym')),
  (gen_random_uuid(), 'session', now() + interval '2 day' + interval '10 hours', now(), 45,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Client 3' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Prof 2' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[], 40, true, 'One-on-one session', (SELECT id FROM public.companies WHERE name='Beta Gym')),
  (gen_random_uuid(), 'class', now() + interval '3 day' + interval '17 hours', now(), 50,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Client 1' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym')),(SELECT id FROM public.profiles WHERE name='Beta Client 3' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Prof 1' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym')),(SELECT id FROM public.profiles WHERE name='Beta Prof 2' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[], 25, false, 'Afternoon group', (SELECT id FROM public.companies WHERE name='Beta Gym')),
  (gen_random_uuid(), 'session', now() + interval '4 day' + interval '12 hours', now(), 30,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Client 2' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Prof 1' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[], 20, false, 'Quick check-in', (SELECT id FROM public.companies WHERE name='Beta Gym')),
  (gen_random_uuid(), 'class', now() + interval '5 day' + interval '19 hours', now(), 60,
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Client 1' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym')),(SELECT id FROM public.profiles WHERE name='Beta Client 2' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym')),(SELECT id FROM public.profiles WHERE name='Beta Client 3' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[],
    ARRAY[(SELECT id FROM public.profiles WHERE name='Beta Prof 2' AND company=(SELECT id FROM public.companies WHERE name='Beta Gym'))]::uuid[], 35, true, 'Evening group', (SELECT id FROM public.companies WHERE name='Beta Gym'))
;

COMMIT;

-- Verification queries
-- SELECT c.name, count(*) FROM public.profiles p JOIN public.companies c ON p.company = c.id GROUP BY c.name;
-- SELECT e.name, array_length(e.equipment,1) AS eq_count, array_length(e.anatomy,1) AS an_count FROM public.exercises e LIMIT 10;
-- SELECT * FROM public.events ORDER BY datetime LIMIT 10;

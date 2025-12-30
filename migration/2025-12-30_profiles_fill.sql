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

COMMIT;

-- Quick checks
-- SELECT id, name, address, occupation, sport, class_credits, session_credits FROM public.profiles LIMIT 20;
-- SELECT count(*) FROM public.profiles WHERE address IS NULL OR occupation IS NULL OR class_credits IS NULL;

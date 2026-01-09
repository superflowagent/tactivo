-- Script para verificar que los triggers de desvinculación funcionan correctamente
-- Ejecutar este script en el SQL Editor de Supabase Dashboard

-- 1. Ver ejercicios actuales con sus referencias
SELECT 
  id, 
  name, 
  anatomy, 
  equipment,
  array_length(anatomy, 1) as anatomy_count,
  array_length(equipment, 1) as equipment_count
FROM exercises 
WHERE array_length(anatomy, 1) > 0 OR array_length(equipment, 1) > 0
LIMIT 5;

-- 2. Ver lista de anatomy
SELECT id, name FROM anatomy ORDER BY name LIMIT 10;

-- 3. Ver lista de equipment
SELECT id, name FROM equipment ORDER BY name LIMIT 10;

-- PRUEBA MANUAL (descomentar y ejecutar paso a paso):
-- 
-- Paso 1: Crear un anatomy de prueba
-- INSERT INTO anatomy (name, company) 
-- VALUES ('TEST_ANATOMY_DELETE', (SELECT company FROM profiles LIMIT 1))
-- RETURNING id, name;
-- 
-- Paso 2: Asignar ese anatomy a un ejercicio (usar el id del paso anterior)
-- UPDATE exercises 
-- SET anatomy = array_append(anatomy, 'ID_DEL_ANATOMY_DE_PRUEBA'::uuid)
-- WHERE id = (SELECT id FROM exercises LIMIT 1)
-- RETURNING id, name, anatomy;
-- 
-- Paso 3: Verificar que el ejercicio tiene el anatomy
-- SELECT id, name, anatomy FROM exercises 
-- WHERE 'ID_DEL_ANATOMY_DE_PRUEBA'::uuid = ANY(anatomy);
-- 
-- Paso 4: ELIMINAR el anatomy de prueba (esto debe activar el trigger)
-- DELETE FROM anatomy WHERE id = 'ID_DEL_ANATOMY_DE_PRUEBA'::uuid;
-- 
-- Paso 5: Verificar que el ejercicio YA NO tiene ese anatomy
-- SELECT id, name, anatomy FROM exercises 
-- WHERE id = (SELECT id FROM exercises LIMIT 1);
-- 
-- ✅ Si el anatomy ya no aparece en el array, el trigger funciona correctamente!

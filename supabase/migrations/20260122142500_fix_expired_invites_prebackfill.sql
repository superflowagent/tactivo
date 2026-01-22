-- 20260122142500_fix_expired_invites_prebackfill.sql
-- Limpiar invites expiradas **antes** del backfill de perfiles
-- Idempotente: puede ejecutarse varias veces sin efectos adversos

BEGIN;

-- Establecer a NULL las fechas de invitación que ya están en el pasado
UPDATE public.profiles
SET invite_expires_at = NULL
WHERE invite_expires_at IS NOT NULL
  AND invite_expires_at <= now();

COMMIT;

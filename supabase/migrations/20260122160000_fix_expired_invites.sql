-- 20260122160000_fix_expired_invites.sql
-- Limpiar invites expiradas para que la constraint `profiles_invite_expires_valid` no falle
-- Idempotente: puede ejecutarse varias veces sin efectos adversos

BEGIN;

-- Establecer a NULL las fechas de invitación que ya están en el pasado
UPDATE public.profiles
SET invite_expires_at = NULL
WHERE invite_expires_at IS NOT NULL
  AND invite_expires_at <= now();

COMMIT;

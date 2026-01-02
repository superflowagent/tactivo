-- Migration: add accept_invite RPC to link an authenticated user to a pending invite

BEGIN;

-- Drop existing function if present
DROP FUNCTION IF EXISTS public.accept_invite(text);

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    p record;
BEGIN
    -- Find profile by token
    SELECT * INTO p FROM public.profiles WHERE invite_token = p_token LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_token';
    END IF;

    -- Check expiry
    IF p.invite_expires_at IS NOT NULL AND p.invite_expires_at < now() THEN
        RAISE EXCEPTION 'token_expired';
    END IF;

    -- Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    -- Ensure profile not already linked to another user
    IF p.user IS NOT NULL AND p.user <> auth.uid() THEN
        RAISE EXCEPTION 'profile_already_linked';
    END IF;

    -- Link profile to current user and clear token fields
    UPDATE public.profiles
    SET "user" = auth.uid(), invite_token = NULL, invite_expires_at = NULL
    WHERE id = p.id;

    RETURN (SELECT to_jsonb(profiles) FROM public.profiles WHERE id = p.id);
END;
$$;

COMMIT;
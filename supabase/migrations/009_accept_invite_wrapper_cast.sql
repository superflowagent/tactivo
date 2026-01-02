-- Migration: modify wrapper RPC to cast token to uuid to match profiles.invite_token type

BEGIN;

DROP FUNCTION IF EXISTS public.accept_invite_http(text);

CREATE OR REPLACE FUNCTION public.accept_invite_http(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Cast incoming token to uuid and delegate to uuid overload to avoid operator mismatches
    RETURN public.accept_invite(p_token::uuid);
END;
$$;

COMMIT;
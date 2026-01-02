-- Migration: add wrapper RPC to resolve PostgREST overload ambiguity for HTTP clients

BEGIN;

DROP FUNCTION IF EXISTS public.accept_invite_http(text);

CREATE OR REPLACE FUNCTION public.accept_invite_http(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delegate to existing accept_invite(text) to avoid ambiguity with an accept_invite(uuid) overload
    RETURN public.accept_invite(p_token);
END;
$$;

COMMIT;
-- Migration: simplify accept_invite_debug to return SQLERRM and SQLSTATE only

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_invite_debug(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    res jsonb;
BEGIN
    BEGIN
        -- delegate to the existing accept_invite overloads; prefer uuid if possible
        BEGIN
            res := public.accept_invite(p_token);
            RETURN jsonb_build_object('ok', true, 'result', res);
        EXCEPTION WHEN SQLSTATE '42883' THEN
            -- function not found for text: try uuid overload
            res := public.accept_invite(p_token::uuid);
            RETURN jsonb_build_object('ok', true, 'result', res);
        END;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
    END;
END;
$$;

COMMIT;
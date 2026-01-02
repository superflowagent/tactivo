-- Migration: add verbose accept_invite diagnostic function to trace each step

BEGIN;

DROP FUNCTION IF EXISTS public.accept_invite_verbose(text);

CREATE OR REPLACE FUNCTION public.accept_invite_verbose(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    p record;
    uid_text text := NULL;
    result jsonb := '{}'::jsonb;
BEGIN
    -- Attempt to find by uuid token first
    BEGIN
        SELECT * INTO p FROM public.profiles WHERE invite_token = p_token::uuid LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
        -- token is not uuid; try text match
        BEGIN
            SELECT * INTO p FROM public.profiles WHERE invite_token::text = p_token LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('ok', false, 'step', 'select', 'error', SQLERRM);
        END;
    END;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'step', 'select', 'error', 'profile_not_found');
    END IF;

    result := result || jsonb_build_object('found_profile_id', p.id);

    -- auth check
    BEGIN
        uid_text := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'step', 'auth', 'error', SQLERRM);
    END;

    IF uid_text IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'step', 'auth', 'error', 'not_authenticated');
    END IF;

    result := result || jsonb_build_object('auth_uid', uid_text);

    -- check already linked
    IF p."user" IS NOT NULL AND p."user" <> uid_text THEN
        RETURN jsonb_build_object('ok', false, 'step', 'precheck', 'error', 'profile_already_linked', 'profile_user', p."user", 'caller', uid_text);
    END IF;

    -- Attempt update
    BEGIN
        UPDATE public.profiles
        SET "user" = uid_text::uuid, invite_token = NULL, invite_expires_at = NULL
        WHERE id = p.id;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'step', 'update', 'error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    result := result || jsonb_build_object('update', 'ok');

    -- Attempt to return JSONB representation
    BEGIN
        result := result || jsonb_build_object('profile', (SELECT to_jsonb(profiles) FROM public.profiles WHERE id = p.id));
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'step', 'to_jsonb', 'error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    RETURN jsonb_build_object('ok', true) || result;
END;
$$;

COMMIT;
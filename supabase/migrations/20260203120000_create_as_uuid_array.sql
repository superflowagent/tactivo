-- Migration: Create helper function as_uuid_array
-- Created automatically to restore missing function on remote DB

CREATE OR REPLACE FUNCTION public.as_uuid_array(_val anyelement) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
    AS $$
DECLARE
  _t text := pg_typeof(_val)::text;
  _res uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _val IS NULL THEN
    RETURN _res;
  END IF;

  IF _t = 'uuid[]' THEN
    RETURN _val;
  ELSIF _t IN ('text','varchar','character varying') THEN
    BEGIN
      _res := ARRAY[ NULLIF(_val::text,'')::uuid ];
      RETURN _res;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN ARRAY[]::uuid[];
    END;
  ELSIF right(_t, 2) = '[]' THEN
    BEGIN
      RETURN (SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) FROM unnest(_val) AS x);
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN ARRAY[]::uuid[];
    END;
  ELSE
    RETURN ARRAY[]::uuid[];
  END IF;
END;
$$;

ALTER FUNCTION public.as_uuid_array(_val anyelement) OWNER TO postgres;

GRANT ALL ON FUNCTION public.as_uuid_array(_val anyelement) TO anon;
GRANT ALL ON FUNCTION public.as_uuid_array(_val anyelement) TO authenticated;
GRANT ALL ON FUNCTION public.as_uuid_array(_val anyelement) TO service_role;

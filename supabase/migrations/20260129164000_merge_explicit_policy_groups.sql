-- Merge explicit groups of conflicting (multiple permissive) policies reported by the linter
-- For each entry: DROP the listed policies and create a single merged policy preserving conditions (OR)
BEGIN;

DO $$
DECLARE
  entry TEXT;
  parts TEXT[];
  schemaname TEXT := 'public';
  tbl TEXT;
  action TEXT;
  role TEXT;
  pols TEXT[];
  p TEXT;
  using_expr TEXT := NULL;
  check_expr TEXT := NULL;
  role_list TEXT;
  newname TEXT;
  expr TEXT;
  names TEXT;
  u_expr TEXT;
  c_expr TEXT;
  rec RECORD;
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('anatomy|DELETE|authenticated|Company members can delete,combined_anatomy_ALL_24c868726485fb7f398a79147c9c1ea9'),
    ('anatomy|SELECT|authenticated|combined_anatomy_ALL_24c868726485fb7f398a79147c9c1ea9,combined_anatomy_SELECT_2ecc23b8146f11c470d0f0d5b4275825'),
    ('anatomy|UPDATE|authenticated|Company members can update,combined_anatomy_ALL_24c868726485fb7f398a79147c9c1ea9'),
    ('classes_templates|DELETE|authenticated|delete_classes_templates_by_professional,insert_classes_templates_by_professional'),
    ('classes_templates|SELECT|authenticated|insert_classes_templates_by_professional,select_classes_templates_by_company'),
    ('classes_templates|UPDATE|authenticated|insert_classes_templates_by_professional,update_classes_templates_by_professional'),
    ('equipment|DELETE|authenticated|Company members can delete,combined_equipment_ALL_4610b750e75692447e89fafe3e6d5685'),
    ('equipment|SELECT|authenticated|combined_equipment_ALL_4610b750e75692447e89fafe3e6d5685,combined_equipment_SELECT_eba253d9f45a68c257a648bb4c10d8ce'),
    ('equipment|UPDATE|authenticated|Company members can update,combined_equipment_ALL_4610b750e75692447e89fafe3e6d5685'),
    ('events|DELETE|authenticated|combined_events_ALL_fd98b4c831b505ef7cc41baf69516042,combined_events_DELETE_be05ee54cf0a914847cf75a05cca462e'),
    ('events|SELECT|authenticated|combined_events_ALL_fd98b4c831b505ef7cc41baf69516042,combined_events_SELECT_c5803103649699381bff8e3af805b317'),
    ('events|UPDATE|authenticated|combined_events_ALL_fd98b4c831b505ef7cc41baf69516042,combined_events_UPDATE_9a18e5870689b8eb1650f5b5a636fcdf'),
    ('exercises|DELETE|authenticated|Company members can delete,combined_exercises_ALL_232c3a4d4340be1cb0aa1926c52d13b7'),
    ('exercises|SELECT|authenticated|combined_exercises_ALL_232c3a4d4340be1cb0aa1926c52d13b7,combined_exercises_SELECT_0c286cf94ff6e843601a2d62f9644171'),
    ('exercises|UPDATE|authenticated|Company members can update,combined_exercises_ALL_232c3a4d4340be1cb0aa1926c52d13b7'),
    ('profiles|DELETE|authenticated|Enable insert for authenticated users only,combined_profiles_DELETE_9330d3157aa1a3953e263b5b487994d9'),
    ('profiles|SELECT|authenticated|Enable insert for authenticated users only,combined_profiles_SELECT_c43d1ed0fe3a9e43d3702f4bc9deb03c'),
    ('profiles|UPDATE|authenticated|Enable insert for authenticated users only,combined_profiles_UPDATE_3e4f1a491a227d564ecbecd4f2376433'),
    ('program_exercises|DELETE|authenticated|Company members can delete,Company members can insert'),
    ('program_exercises|SELECT|authenticated|Company members can insert,Company members can select'),
    ('program_exercises|UPDATE|authenticated|Company members can insert,Company members can update'),
    ('programs|DELETE|authenticated|Company members can delete,Company members can insert'),
    ('programs|SELECT|authenticated|Company members can insert,Company members can select'),
    ('programs|UPDATE|authenticated|Company members can insert,Company members can update')
  ) AS t(entry) LOOP

    parts := string_to_array(entry, '|');
    tbl := parts[1];
    action := parts[2];
    role := parts[3];
    pols := string_to_array(parts[4], ',');

    using_expr := NULL;
    check_expr := NULL;
    role_list := role; -- preserve the role reported by linter
    names := NULL;

    -- Aggregate expressions from existing policies
    FOR p IN SELECT unnest(pols) AS p LOOP
        SELECT pg_get_expr(polqual, polrelid) AS u, pg_get_expr(polwithcheck, polrelid) AS c
        INTO u_expr, c_expr
        FROM pg_policy
        WHERE polname = p AND polrelid = (schemaname||'.'||tbl)::regclass
        LIMIT 1;

        IF u_expr IS NOT NULL THEN
          IF using_expr IS NULL THEN
            using_expr := '(' || u_expr || ')';
          ELSE
            using_expr := using_expr || ' OR (' || u_expr || ')';
          END IF;
        END IF;
        IF c_expr IS NOT NULL THEN
          IF check_expr IS NULL THEN
            check_expr := '(' || c_expr || ')';
          ELSE
            check_expr := check_expr || ' OR (' || c_expr || ')';
          END IF;
        END IF;

        names := COALESCE(names || ',', '') || p;
      END LOOP;
    IF names IS NULL THEN
      RAISE NOTICE 'No policies found to merge for % % %; skipping', tbl, action, role;
      CONTINUE;
    END IF;

    newname := format('merged_%s_%s_%s', tbl, action, md5(names));
    RAISE NOTICE 'Merging policies % on % for action % role % into %', names, tbl, action, role, newname;

    -- Drop listed policies
    FOR p IN SELECT unnest(pols) AS pname LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p, schemaname, tbl);
    END LOOP;

    -- Create merged policy (include WITH CHECK only for INSERT/UPDATE)
    IF action IN ('INSERT','UPDATE') THEN
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR %s TO %I %s %s', newname, schemaname, tbl, action,
        role_list,
        CASE WHEN using_expr IS NOT NULL THEN 'USING (' || using_expr || ')' ELSE '' END,
        CASE WHEN check_expr IS NOT NULL THEN 'WITH CHECK (' || check_expr || ')' ELSE '' END);
    ELSE
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR %s TO %I %s', newname, schemaname, tbl, action,
        role_list,
        CASE WHEN using_expr IS NOT NULL THEN 'USING (' || using_expr || ')' ELSE '' END);
    END IF;

  END LOOP;
END$$;

COMMIT;

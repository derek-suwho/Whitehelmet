-- ==========================================================================
-- Role Schema v2
-- Introduces project-scoped participant_role in project_members and renames
-- global profile roles: org_super_admin → super_admin, rest → participant.
-- All steps run in a single transaction.
-- ==========================================================================

BEGIN;

-- ── 1a. Add participant_role to project_members ───────────────────────────────
-- nullable first so the column can be filled before setting NOT NULL

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS participant_role TEXT;

UPDATE public.project_members
  SET participant_role = 'focal'
  WHERE participant_role IS NULL;

ALTER TABLE public.project_members
  ALTER COLUMN participant_role SET NOT NULL,
  ADD CONSTRAINT project_members_participant_role_check
    CHECK (participant_role IN ('focal', 'member', 'viewer'));


-- ── 1b. Backfill org_admin users into project_members as focal ────────────────

INSERT INTO public.project_members (id, project_id, user_id, added_at, participant_role)
SELECT gen_random_uuid(), p.id::text, pr.id::text, now(), 'focal'
FROM public.projects p
CROSS JOIN public.profiles pr
WHERE pr.role = 'org_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p.id::text AND pm.user_id = pr.id::text
  );


-- ── 1c. Backfill org_member users into project_members as member ──────────────

INSERT INTO public.project_members (id, project_id, user_id, added_at, participant_role)
SELECT gen_random_uuid(), p.id::text, pr.id::text, now(), 'member'
FROM public.projects p
CROSS JOIN public.profiles pr
WHERE pr.role = 'org_member'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p.id::text AND pm.user_id = pr.id::text
  );


-- ── 1d. Drop old role check constraint (dynamic — works regardless of name) ───

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class     rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid
                          AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname  = 'profiles'
      AND con.contype  = 'c'
      AND att.attname  = 'role'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;


-- ── 1e. Rename global roles (AFTER project_members backfill) ─────────────────

UPDATE public.profiles SET role = 'super_admin' WHERE role = 'org_super_admin';
UPDATE public.profiles SET role = 'participant'  WHERE role IN ('org_admin', 'org_member', 'subcontractor');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'coe_admin', 'participant'));


-- ── 1f. Replace auth trigger with new role normalization ─────────────────────

CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _raw  TEXT;
  _role TEXT;
BEGIN
  _raw := new.raw_user_meta_data->>'role';

  _role := CASE _raw
    -- Legacy values (retained permanently for safety)
    WHEN 'pif_admin'       THEN 'super_admin'
    WHEN 'org_super_admin' THEN 'super_admin'
    WHEN 'devco_admin'     THEN 'participant'
    WHEN 'org_admin'       THEN 'participant'
    WHEN 'devco_user'      THEN 'participant'
    WHEN 'org_member'      THEN 'participant'
    WHEN 'subcontractor'   THEN 'participant'
    -- Canonical values
    WHEN 'super_admin'     THEN 'super_admin'
    WHEN 'coe_admin'       THEN 'coe_admin'
    WHEN 'participant'     THEN 'participant'
    -- Fail closed: unknown or absent → least privileged
    ELSE                        'participant'
  END;

  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    _role
  )
  ON CONFLICT (id) DO UPDATE
    SET email        = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        role         = EXCLUDED.role;

  RETURN new;
END;
$$;


-- ── 1g. Update RLS policies (admin = super_admin OR coe_admin) ───────────────

-- profiles
DROP POLICY IF EXISTS "profiles_org_super_admin_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_pif_read_all"             ON public.profiles;
CREATE POLICY "profiles_admin_read_all" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'coe_admin')
    )
  );

-- organizations
DROP POLICY IF EXISTS "orgs_org_super_admin_all" ON public.organizations;
DROP POLICY IF EXISTS "orgs_pif_all"              ON public.organizations;
CREATE POLICY "orgs_admin_all" ON public.organizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'coe_admin')
    )
  );

-- templates
DROP POLICY IF EXISTS "templates_org_super_admin_all" ON public.templates;
DROP POLICY IF EXISTS "templates_pif_all"              ON public.templates;
CREATE POLICY "templates_admin_all" ON public.templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'coe_admin')
    )
  );

-- template_versions
DROP POLICY IF EXISTS "versions_org_super_admin_all" ON public.template_versions;
DROP POLICY IF EXISTS "versions_pif_all"              ON public.template_versions;
CREATE POLICY "versions_admin_all" ON public.template_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'coe_admin')
    )
  );

-- consolidated_sheets
DROP POLICY IF EXISTS "consolidated_org_super_admin_all" ON public.consolidated_sheets;
DROP POLICY IF EXISTS "consolidated_pif_all"              ON public.consolidated_sheets;
CREATE POLICY "consolidated_admin_all" ON public.consolidated_sheets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'coe_admin')
    )
  );

COMMIT;

-- Forward-only migration: complete the role rename for already-deployed environments.
-- Safe to run on both fresh installs and databases that already applied 20260507100000.
--
-- Fixes:
--   1. profiles.role check constraint still blocks new signups (dynamic drop by column, not by guessed name)
--   2. Existing rows still carry old role values → 403s for all users
--   3. Trigger trusted unsanitized auth metadata (could violate new constraint on insert)
--   4. Trigger on-conflict only synced email (role/display_name drifted silently on updates)
--   5. RLS policies still hard-coded pif_admin (blocked org_super_admin from admin views)

-- ── 1. Drop ALL check constraints on profiles.role (discovers name dynamically) ──
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class     rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid
                          and att.attnum = any(con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and att.attname = 'role'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;

-- ── 2. Backfill existing rows ──────────────────────────────────────────────────
update public.profiles set role = 'org_super_admin' where role = 'pif_admin';
update public.profiles set role = 'org_admin'       where role = 'devco_admin';
update public.profiles set role = 'org_member'      where role = 'devco_user';

-- ── 3. Add new check constraint ────────────────────────────────────────────────
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('org_super_admin', 'org_admin', 'org_member', 'subcontractor'));

-- ── 4. Hardened trigger ────────────────────────────────────────────────────────
--   • Normalizes legacy role values from auth metadata before inserting
--   • Fails closed: unknown/missing roles default to 'subcontractor' (least privileged)
--   • On-conflict now syncs role and display_name (not just email)
create or replace function public.handle_auth_user_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _raw_role text;
  _role     text;
begin
  _raw_role := new.raw_user_meta_data->>'role';

  -- Normalize legacy and current role values; unknown/absent values → least-privileged role
  _role := case _raw_role
    when 'pif_admin'       then 'org_super_admin'
    when 'devco_admin'     then 'org_admin'
    when 'devco_user'      then 'org_member'
    when 'org_super_admin' then 'org_super_admin'
    when 'org_admin'       then 'org_admin'
    when 'org_member'      then 'org_member'
    when 'subcontractor'   then 'subcontractor'
    else                        'subcontractor'   -- fail closed: unknown → least privileged
  end;

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    _role
  )
  on conflict (id) do update
    set email        = excluded.email,
        display_name = excluded.display_name,
        role         = excluded.role;

  return new;
end;
$$;

-- ── 5. Update RLS policies that hard-code old role names ───────────────────────

-- profiles
drop policy if exists "profiles_pif_read_all" on public.profiles;
create policy "profiles_org_super_admin_read_all" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'org_super_admin')
  );

-- organizations
drop policy if exists "orgs_pif_all" on public.organizations;
create policy "orgs_org_super_admin_all" on public.organizations
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'org_super_admin')
  );

-- templates
drop policy if exists "templates_pif_all" on public.templates;
create policy "templates_org_super_admin_all" on public.templates
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'org_super_admin')
  );

-- template_versions
drop policy if exists "versions_pif_all" on public.template_versions;
create policy "versions_org_super_admin_all" on public.template_versions
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'org_super_admin')
  );

-- consolidated_sheets
drop policy if exists "consolidated_pif_all" on public.consolidated_sheets;
create policy "consolidated_org_super_admin_all" on public.consolidated_sheets
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'org_super_admin')
  );

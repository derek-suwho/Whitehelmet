# Fix Role Rename Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the role rename across the full stack: (1) add a new forward-only migration that safely repairs already-deployed environments, (2) update all four Edge Functions that still gate on `pif_admin`, (3) harden the trigger to normalize legacy role strings, sync role/display_name on updates, and fail closed on unknown input.

**Architecture:** A new migration file is added instead of rewriting the historical one — deployed environments won't rerun a file they've already applied. Edge Functions are updated in the same PR so the role rename is atomic across all auth check points. The trigger is hardened to eliminate the trust-boundary risk of elevating unknown auth metadata to `org_member`.

**Tech Stack:** PostgreSQL / Supabase migrations (plain SQL), Deno / TypeScript (Supabase Edge Functions)

---

## Background

### Role rename map

| Old role (in DB / auth metadata) | New role (in `rbac.py`) |
|---|---|
| `pif_admin` | `org_super_admin` |
| `devco_admin` | `org_admin` |
| `devco_user` | `org_member` |
| `subcontractor` | `subcontractor` (unchanged) |

### Why the current migration is broken

`20260422130000_g2_templates.sql` created `profiles` with:

```sql
role text not null check (role in ('pif_admin', 'devco_admin', 'devco_user'))
```

`20260507100000_fix_profile_trigger_role.sql` only changes the trigger default to `'org_member'` — it never touches the constraint or existing rows.
Result: every new signup fails with a check-constraint violation, and every existing user gets a 403 because `rbac.py` no longer recognises `devco_user`/`devco_admin`/`pif_admin`.

### Why we add a NEW migration instead of rewriting the old one

Supabase/Alembic migration chains are forward-only. Any environment that has already applied `20260507100000_fix_profile_trigger_role.sql` will not rerun it if its content changes on disk — the migration runner considers it done. Rewriting a historical migration fixes only fresh installs; all deployed environments retain the stale constraint, old row values, and broken trigger. Adding a new timestamped migration (`20260508000000_role_rename_complete.sql`) is the only approach that repairs both fresh and already-deployed environments.

### Why the old file must be reverted

We already edited `20260507100000_fix_profile_trigger_role.sql` this session. That edit must be reverted so the file matches what deployed environments have already applied — otherwise the migration chain hash diverges and can cause runner errors. The real fix lives entirely in the new migration.

### RLS policies that reference old role names (fixed in new migration)

All five are in `20260422130000_g2_templates.sql`:

| Policy name | Table | Condition referencing old role |
|---|---|---|
| `profiles_pif_read_all` | `profiles` | `p.role = 'pif_admin'` |
| `orgs_pif_all` | `organizations` | `p.role = 'pif_admin'` |
| `templates_pif_all` | `templates` | `p.role = 'pif_admin'` |
| `versions_pif_all` | `template_versions` | `p.role = 'pif_admin'` |
| `consolidated_pif_all` | `consolidated_sheets` | `p.role = 'pif_admin'` |

### Edge Functions that check `pif_admin` (all four must be updated)

| File | Line | Current check |
|---|---|---|
| `supabase/functions/g2-consolidate/index.ts` | 25 | `profile?.role !== 'pif_admin'` |
| `supabase/functions/g2-finetune-consolidated/index.ts` | 25 | `profile?.role !== 'pif_admin'` |
| `supabase/functions/g2-parse-template/index.ts` | 26 | `profile?.role !== 'pif_admin'` |
| `supabase/functions/g2-generate-template-ai/index.ts` | 37 | `profile?.role !== 'pif_admin'` |

---

## File Map

| Action | File |
|---|---|
| **Revert** | `supabase/migrations/20260507100000_fix_profile_trigger_role.sql` |
| **Create** | `supabase/migrations/20260508000000_role_rename_complete.sql` |
| **Modify** | `supabase/functions/g2-consolidate/index.ts` |
| **Modify** | `supabase/functions/g2-finetune-consolidated/index.ts` |
| **Modify** | `supabase/functions/g2-parse-template/index.ts` |
| **Modify** | `supabase/functions/g2-generate-template-ai/index.ts` |

---

## Chunk 1: Migration files

### Task 1: Revert the previously edited migration to its original state

**Files:**
- Modify: `supabase/migrations/20260507100000_fix_profile_trigger_role.sql`

- [ ] **Step 1: Overwrite the file with its original 17-line content**

This restores what deployed environments have already applied:

```sql
-- Fix default role in profile sync trigger: devco_user → org_member (role rename)

create or replace function public.handle_auth_user_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'org_member')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;
```

- [ ] **Step 2: Verify the file matches the original**

```bash
cat supabase/migrations/20260507100000_fix_profile_trigger_role.sql | wc -l
```

Expected: 17 lines.

---

### Task 2: Create the new forward-only migration

**Files:**
- Create: `supabase/migrations/20260508000000_role_rename_complete.sql`

- [ ] **Step 1: Create the new migration file**

```sql
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
```

- [ ] **Step 2: Verify both migration files exist**

```bash
ls -1 supabase/migrations/ | grep -E "20260507100000|20260508000000"
```

Expected:
```
20260507100000_fix_profile_trigger_role.sql
20260508000000_role_rename_complete.sql
```

- [ ] **Step 3: Grep for remaining old role names in all migrations**

```bash
grep -rn "pif_admin\|devco_admin\|devco_user" supabase/migrations/
```

Expected: matches only in `20260422130000_g2_templates.sql` (the original schema — historical, not a problem). No matches in `20260507100000` or `20260508000000`.

- [ ] **Step 4: Commit migration files**

```bash
git add supabase/migrations/20260507100000_fix_profile_trigger_role.sql \
        supabase/migrations/20260508000000_role_rename_complete.sql
git commit -m "fix: add role rename migration — constraint, backfill, hardened trigger, RLS"
```

---

## Chunk 2: Edge Functions

### Task 3: Update all four Edge Functions from `pif_admin` to `org_super_admin`

All four functions have the same pattern at the same line structure. Change `'pif_admin'` → `'org_super_admin'` and update the adjacent comment where present.

**Files:**
- Modify: `supabase/functions/g2-consolidate/index.ts:25`
- Modify: `supabase/functions/g2-finetune-consolidated/index.ts:25`
- Modify: `supabase/functions/g2-parse-template/index.ts:20,26`
- Modify: `supabase/functions/g2-generate-template-ai/index.ts:37`

- [ ] **Step 1: Read each file to confirm the exact line before editing**

```bash
grep -n "pif_admin" supabase/functions/g2-consolidate/index.ts \
                    supabase/functions/g2-finetune-consolidated/index.ts \
                    supabase/functions/g2-parse-template/index.ts \
                    supabase/functions/g2-generate-template-ai/index.ts
```

Expected: one match per file at the role check line (plus one comment line in `g2-parse-template`).

- [ ] **Step 2: Update `g2-consolidate/index.ts`**

Change line 25:
```typescript
// Before:
if (profile?.role !== 'pif_admin') return json({ error: 'Forbidden' }, 403)
// After:
if (profile?.role !== 'org_super_admin') return json({ error: 'Forbidden' }, 403)
```

- [ ] **Step 3: Update `g2-finetune-consolidated/index.ts`**

Change line 25:
```typescript
// Before:
if (profile?.role !== 'pif_admin') return json({ error: 'Forbidden' }, 403)
// After:
if (profile?.role !== 'org_super_admin') return json({ error: 'Forbidden' }, 403)
```

- [ ] **Step 4: Update `g2-parse-template/index.ts`**

Change line 20 (comment) and line 26 (check):
```typescript
// Before (line 20):
// Verify pif_admin
// After:
// Verify org_super_admin

// Before (line 26):
if (profile?.role !== 'pif_admin') return json({ error: 'Forbidden' }, 403)
// After:
if (profile?.role !== 'org_super_admin') return json({ error: 'Forbidden' }, 403)
```

- [ ] **Step 5: Update `g2-generate-template-ai/index.ts`**

Change line 37:
```typescript
// Before:
if (profile?.role !== 'pif_admin') return json({ error: 'Forbidden' }, 403)
// After:
if (profile?.role !== 'org_super_admin') return json({ error: 'Forbidden' }, 403)
```

- [ ] **Step 6: Verify no remaining `pif_admin` references in functions**

```bash
grep -rn "pif_admin\|devco_admin\|devco_user" supabase/functions/
```

Expected: zero matches.

- [ ] **Step 7: Verify no remaining old role names in backend Python**

```bash
grep -rn "pif_admin\|devco_admin\|devco_user" backend/app/
```

Expected: zero matches.

- [ ] **Step 8: Commit edge function updates**

```bash
git add supabase/functions/g2-consolidate/index.ts \
        supabase/functions/g2-finetune-consolidated/index.ts \
        supabase/functions/g2-parse-template/index.ts \
        supabase/functions/g2-generate-template-ai/index.ts
git commit -m "fix: update edge functions pif_admin → org_super_admin"
```

---

## Verification

After applying the new migration to a Supabase instance (local or staging):

- [ ] `select conname, consrc from pg_constraint join pg_class on pg_class.oid = conrelid where relname = 'profiles' and contype = 'c';` shows only `profiles_role_check` with new role values
- [ ] `select distinct role from profiles;` returns only new role names
- [ ] New signup with **no** role in `raw_user_meta_data` creates a profile with `role = 'subcontractor'` (fail-closed)
- [ ] New signup with legacy `raw_user_meta_data.role = 'devco_user'` creates a profile with `role = 'org_member'` (normalization)
- [ ] New signup with `raw_user_meta_data.role = 'pif_admin'` creates a profile with `role = 'org_super_admin'` (normalization)
- [ ] Updating an existing `auth.users` row's `raw_user_meta_data.role` propagates to `profiles.role` (on-conflict sync)
- [ ] An `org_super_admin` user can call all four Edge Functions without a 403
- [ ] An `org_admin` user is blocked by all four Edge Functions with a 403
- [ ] An `org_super_admin` user can read all profiles via RLS
- [ ] An `org_member` user cannot read other users' profiles via RLS
- [ ] Backend `/api/auth/me` returns the user without a 403

---

## Unresolved Questions

- Are there seed scripts or test fixtures that insert old role values (`pif_admin`, `devco_user`, etc.) that also need updating?
- Should `subcontractor` (the fail-closed default) trigger a monitoring alert or log warning so ops can detect misconfigured Keycloak token payloads?

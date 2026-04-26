-- ============================================================
-- Shared Foundation Schema
-- ============================================================

-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('pif', 'devco')),
  parent_org_id uuid references organizations(id),
  created_at timestamptz default now() not null
);

-- profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  role text not null check (role in ('pif_admin', 'devco_admin', 'devco_user')),
  display_name text not null,
  created_at timestamptz default now() not null
);

-- templates
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references profiles(id),
  status text not null default 'draft' check (status in ('draft', 'active', 'deprecated')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- template_versions
create table template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade,
  version_number integer not null,
  schema_json jsonb not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now() not null,
  unique (template_id, version_number)
);

-- template_assignments
create table template_assignments (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid references template_versions(id),
  org_id uuid references organizations(id),
  assigned_by uuid references profiles(id),
  deadline timestamptz,
  submission_type text not null default 'template' check (submission_type in ('template', 'freeform')),
  instructions text,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'locked')),
  upload_token text unique,
  upload_token_expires_at timestamptz,
  assigned_at timestamptz default now() not null,
  constraint freeform_no_template check (
    submission_type = 'freeform' or template_version_id is not null
  )
);

-- submissions
create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references template_assignments(id),
  org_id uuid references organizations(id),
  file_path text not null,
  file_name text not null,
  status text not null default 'submitted' check (status in ('submitted', 'locked')),
  submitted_at timestamptz default now() not null,
  submitted_by uuid references profiles(id)
);

-- formulas
create table formulas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  nl_prompt text,
  expression text not null,
  formula_type text not null check (formula_type in ('aggregation', 'calculation', 'lookup', 'transformation')),
  is_library_item boolean not null default false,
  created_by uuid references profiles(id),
  usage_count integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- consolidated_sheets
create table consolidated_sheets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id),
  file_path text not null,
  generated_by uuid references profiles(id),
  generated_at timestamptz default now() not null
);

-- ============================================================
-- Baseline RLS (Shared Foundation)
-- ============================================================

-- profiles: users can only read their own profile; pif_admin reads all
alter table profiles enable row level security;
create policy "profiles_self_read" on profiles for select using (id = auth.uid());
create policy "profiles_pif_read_all" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);

-- organizations: pif_admin sees all; devco users see their own org
alter table organizations enable row level security;
create policy "orgs_pif_all" on organizations for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
create policy "orgs_devco_own" on organizations for select using (
  id = (select org_id from profiles where id = auth.uid())
);

-- ============================================================
-- Group 2 RLS Policies
-- ============================================================

-- templates
alter table templates enable row level security;
create policy "templates_pif_all" on templates for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
create policy "templates_devco_active_read" on templates for select using (
  status = 'active' and
  exists (
    select 1 from template_assignments ta
    join template_versions tv on tv.id = ta.template_version_id
    where tv.template_id = templates.id
      and ta.org_id = (select org_id from profiles where id = auth.uid())
  )
);

-- template_versions
alter table template_versions enable row level security;
create policy "versions_pif_all" on template_versions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
create policy "versions_devco_assigned_read" on template_versions for select using (
  exists (
    select 1 from template_assignments ta
    where ta.template_version_id = template_versions.id
      and ta.org_id = (select org_id from profiles where id = auth.uid())
  )
);

-- consolidated_sheets
alter table consolidated_sheets enable row level security;
create policy "consolidated_pif_all" on consolidated_sheets for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);

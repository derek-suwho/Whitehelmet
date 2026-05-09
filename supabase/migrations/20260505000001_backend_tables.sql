-- supabase/migrations/20260505000001_backend_tables.sql
-- Backend-owned tables that have no prior Supabase DDL.
-- Sessions table is intentionally omitted — auth uses Supabase JWTs (stateless).

-- records — user-scoped consolidation results
create table if not exists public.records (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid,
  name text not null,
  source_count integer not null default 0,
  row_count integer not null default 0,
  col_count integer not null default 0,
  spreadsheet_data bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_user_id_idx on public.records(user_id);

-- uploaded_files — xlsx upload metadata
create table if not exists public.uploaded_files (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid,
  original_name text not null,
  stored_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 char(64) not null,
  created_at timestamptz not null default now()
);
create index if not exists uploaded_files_user_id_idx on public.uploaded_files(user_id);

-- conversation_history — chat context per record
create table if not exists public.conversation_history (
  id bigserial primary key,
  record_id bigint not null references public.records(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists conversation_history_record_id_idx on public.conversation_history(record_id);

-- projects — admin-created groups of templates + subcontractors
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active',
  created_by uuid references public.profiles(id),
  master_template_id uuid,
  created_at timestamptz not null default now()
);

-- project_members — subcontractors assigned to a project
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);
create index if not exists project_members_project_id_idx on public.project_members(project_id);
create index if not exists project_members_user_id_idx on public.project_members(user_id);

-- template_formulas — Excel formulas attached to a template version
create table if not exists public.template_formulas (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  name text not null,
  target_column text not null,
  formula_type text not null default 'column' check (formula_type in ('column', 'single_cell')),
  expression text not null,
  weight double precision,
  benchmark double precision,
  scoring_rules text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists template_formulas_version_id_idx on public.template_formulas(template_version_id);

-- RLS: deny all anonymous access (backend uses service role, bypasses RLS)
alter table public.records enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.conversation_history enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.template_formulas enable row level security;

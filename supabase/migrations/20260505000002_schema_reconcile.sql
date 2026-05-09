-- supabase/migrations/20260505000002_schema_reconcile.sql
-- Add columns that exist in SQLAlchemy models but were missing from Supabase DDL.
-- All statements are idempotent (add column if not exists pattern).

-- templates: add template_type (subcontractor | master)
alter table public.templates
  add column if not exists template_type text not null default 'subcontractor';

-- submissions: add processed_file_path (path to formula-processed xlsx)
alter table public.submissions
  add column if not exists processed_file_path text;

-- template_assignments: add locking + per-user assignment columns
alter table public.template_assignments
  add column if not exists assigned_to_user_id uuid references public.profiles(id),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id);

-- template_versions: enforce unique version per template
-- (already in the Supabase DDL unique constraint; this is a safety check)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'template_versions_template_id_version_number_key'
      and table_name = 'template_versions'
  ) then
    alter table public.template_versions
      add constraint template_versions_template_id_version_number_key
      unique (template_id, version_number);
  end if;
end $$;

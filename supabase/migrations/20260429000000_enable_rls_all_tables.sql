-- Enable RLS on all public tables that are missing it.
--
-- Both access paths (FastAPI via postgres superuser, Edge Functions via service_role)
-- bypass RLS automatically. Enabling RLS with no anon policies = deny all public access,
-- which is correct for this backend-proxied app.

-- Internal / SQLAlchemy-managed tables (backend-only access)
alter table if exists public.alembic_version enable row level security;
alter table if exists public.records enable row level security;
alter table if exists public.sessions enable row level security;
alter table if exists public.conversation_history enable row level security;
alter table if exists public.uploaded_files enable row level security;
alter table if exists public.org_memberships enable row level security;
alter table if exists public.projects enable row level security;
alter table if exists public.project_members enable row level security;

-- Business tables (also accessed by Edge Functions via service_role)
-- Some of these may already have RLS from prior migration — IF EXISTS + idempotent.
alter table if exists public.organizations enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.templates enable row level security;
alter table if exists public.template_versions enable row level security;
alter table if exists public.template_assignments enable row level security;
alter table if exists public.submissions enable row level security;
alter table if exists public.consolidated_sheets enable row level security;
alter table if exists public.formulas enable row level security;

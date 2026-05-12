-- Drop legacy public.users table.
-- Authentication is handled entirely by Supabase Auth (auth.users).
-- App-specific user data (role, org_id, display_name) lives in public.profiles.

drop table if exists public.users cascade;

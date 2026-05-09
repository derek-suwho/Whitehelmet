-- Add email to profiles and auto-sync from auth.users on signup.

alter table public.profiles
  add column if not exists email text unique;

-- Backfill email for existing profiles from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Trigger: auto-create/update profile row when auth.users is inserted or updated
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_auth_user_sync();

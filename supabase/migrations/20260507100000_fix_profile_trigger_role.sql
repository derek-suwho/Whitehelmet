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

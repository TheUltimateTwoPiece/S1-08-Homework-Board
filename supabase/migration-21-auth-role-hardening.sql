-- Harden account-role assignment.
--
-- The original signup trigger trusted raw_user_meta_data.role. Anyone can
-- call Supabase Auth directly with the public anon key, so that metadata is
-- not a trustworthy authorization signal. New Auth users are always created
-- as students; the server-side signup action promotes verified admin signups
-- with the service-role key.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'student'
  );
  return new;
end;
$$;

-- Keep ordinary authenticated users from changing roles, but permit the
-- server-role client used by the controlled admin-signup flow to provision
-- an admin profile after the server has verified ADMIN_SIGNUP_CODE.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.role is distinct from new.role
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Role cannot be changed';
  end if;
  return new;
end;
$$;

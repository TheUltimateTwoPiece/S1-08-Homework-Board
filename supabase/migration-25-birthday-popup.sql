-- Global birthday popup configuration.
-- Run after the existing migrations. The singleton row keeps activation state
-- consistent for every signed-in user.
create table if not exists public.birthday_settings (
  id smallint primary key default 1 check (id = 1),
  active boolean not null default false,
  celebrant_name text not null default 'Birthday student',
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.birthday_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.birthday_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'birthday_settings'
      and policyname = 'Authenticated users can view birthday settings'
  ) then
    create policy "Authenticated users can view birthday settings"
      on public.birthday_settings for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'birthday_settings'
      and policyname = 'Admins can insert birthday settings'
  ) then
    create policy "Admins can insert birthday settings"
      on public.birthday_settings for insert
      to authenticated
      with check (public.is_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'birthday_settings'
      and policyname = 'Admins can update birthday settings'
  ) then
    create policy "Admins can update birthday settings"
      on public.birthday_settings for update
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

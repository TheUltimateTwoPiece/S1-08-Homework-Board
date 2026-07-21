-- Admin duty scheduling system
-- Run this in the Supabase SQL Editor.

-- Each admin's assigned days of the week
create table public.admin_schedules (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (admin_id, day_of_week)
);

-- Daily duty log: tracks whether an admin completed their post on their scheduled day
create table public.admin_duty_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  completed_post boolean not null default false,
  completed_at timestamptz,
  notified boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (admin_id, scheduled_date)
);

alter table public.admin_schedules enable row level security;
alter table public.admin_duty_logs enable row level security;

-- Admin schedules policies
create policy "Schedules are viewable by all authenticated users"
  on public.admin_schedules for select
  to authenticated
  using (true);

create policy "Admins can manage schedules"
  on public.admin_schedules for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update schedules"
  on public.admin_schedules for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete schedules"
  on public.admin_schedules for delete
  to authenticated
  using (public.is_admin());

create policy "Any admin can view all duty logs"
  on public.admin_duty_logs for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert their own duty logs"
  on public.admin_duty_logs for insert
  to authenticated
  with check (auth.uid() = admin_id and public.is_admin());

create policy "Admins can update their own duty logs"
  on public.admin_duty_logs for update
  to authenticated
  using (auth.uid() = admin_id and public.is_admin())
  with check (auth.uid() = admin_id and public.is_admin());

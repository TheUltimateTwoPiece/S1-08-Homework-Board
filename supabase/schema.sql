-- Run this in the Supabase SQL Editor after creating your project.

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- Homework posts (admin only)
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Comments on posts (all authenticated users)
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- Notifications (admin sends to students)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  created_by uuid not null references public.profiles(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Student completion checklists per post
create table public.post_completions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- Auto-create profile on signup
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
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.post_completions enable row level security;

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (role = (select p.role from public.profiles p where p.id = auth.uid()));

-- Prevent users from changing their role after signup
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.role is distinct from new.role then
    raise exception 'Role cannot be changed';
  end if;
  return new;
end;
$$;

create trigger prevent_profile_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- Posts policies
create policy "Posts are viewable by authenticated users"
  on public.posts for select
  to authenticated
  using (true);

create policy "Admins can create posts"
  on public.posts for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update posts"
  on public.posts for update
  to authenticated
  using (public.is_admin());

create policy "Admins can delete posts"
  on public.posts for delete
  to authenticated
  using (public.is_admin());

-- Comments policies
create policy "Comments are viewable by authenticated users"
  on public.comments for select
  to authenticated
  using (true);

create policy "Authenticated users can comment"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Users can update own comments"
  on public.comments for update
  to authenticated
  using (auth.uid() = author_id);

create policy "Users can delete own comments"
  on public.comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- Notifications policies
create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can send notifications"
  on public.notifications for insert
  to authenticated
  with check (public.is_admin());

create policy "Users can mark own notifications read"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

-- Post completion policies
create policy "Users can view own completions"
  on public.post_completions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all completions"
  on public.post_completions for select
  to authenticated
  using (public.is_admin());

create policy "Users can mark posts complete"
  on public.post_completions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can unmark own completions"
  on public.post_completions for delete
  to authenticated
  using (auth.uid() = user_id);

-- Admin accounts are created at signup with a valid ADMIN_SIGNUP_CODE (see README).

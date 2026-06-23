-- Run this in Supabase SQL Editor if you already set up the database earlier.

create table public.post_completions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_completions enable row level security;

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

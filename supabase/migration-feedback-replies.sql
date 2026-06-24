alter table public.comments
add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Users can create feedback'
  ) then
    create policy "Users can create feedback"
      on public.feedback for insert
      to authenticated
      with check (auth.uid() = author_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Users can view own feedback'
  ) then
    create policy "Users can view own feedback"
      on public.feedback for select
      to authenticated
      using (auth.uid() = author_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Admins can view all feedback'
  ) then
    create policy "Admins can view all feedback"
      on public.feedback for select
      to authenticated
      using (public.is_admin());
  end if;
end $$;

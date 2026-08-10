-- Store each student's checklist progress in their account so it follows
-- them across browsers and devices.

create table if not exists public.post_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  completed_at timestamptz not null default now(),
  unique (post_id, user_id, item_id)
);

alter table public.post_checklist_completions enable row level security;

create policy "Users can view own checklist progress"
  on public.post_checklist_completions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all checklist progress"
  on public.post_checklist_completions for select
  to authenticated
  using (public.is_admin());

create policy "Users can save own checklist progress"
  on public.post_checklist_completions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own checklist progress"
  on public.post_checklist_completions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can remove own checklist progress"
  on public.post_checklist_completions for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can remove checklist progress"
  on public.post_checklist_completions for delete
  to authenticated
  using (public.is_admin());

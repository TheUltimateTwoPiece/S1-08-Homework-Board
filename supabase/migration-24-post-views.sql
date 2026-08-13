-- Per-user post view tracking so admins can see who has actually opened
-- each homework post. One row per (post, user); first/last timestamps keep
-- repeat visits from creating a new row.
create table if not exists public.post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_views enable row level security;

create policy "Users can view own post views"
  on public.post_views for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can record own post views"
  on public.post_views for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own post views"
  on public.post_views for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins can view all post views"
  on public.post_views for select
  to authenticated
  using (public.is_admin());

create index if not exists post_views_post_id_idx
  on public.post_views (post_id);

create index if not exists post_views_user_id_idx
  on public.post_views (user_id);

-- Atomic upsert used by the post detail page. Derives the viewer from
-- auth.uid() internally so callers cannot record a view for another user.
create or replace function public.record_post_view(p_post_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.post_views (post_id, user_id)
  values (p_post_id, auth.uid())
  on conflict (post_id, user_id)
  do update set last_viewed_at = now();
end;
$$;

revoke all on function public.record_post_view(uuid) from public;
grant execute on function public.record_post_view(uuid) to authenticated;

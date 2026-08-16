-- Bug reports submitted by any authenticated user.
-- Screenshots are stored in the private `attachments` bucket under
-- bug-reports/<user-id>/... and their paths are kept on the report row.
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  steps_to_reproduce text not null default '',
  category text not null default 'website'
    check (category in ('website', 'posts', 'pip', 'account', 'other')),
  screenshot_paths text[] not null default '{}'::text[]
    check (cardinality(screenshot_paths) > 0),
  created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

create policy "Users can create own bug reports"
  on public.bug_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can view own bug reports"
  on public.bug_reports for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "Admins can view all bug reports"
  on public.bug_reports for select
  to authenticated
  using (public.is_admin());

create index if not exists bug_reports_created_at_idx
  on public.bug_reports (created_at desc);

create index if not exists bug_reports_reporter_id_idx
  on public.bug_reports (reporter_id);

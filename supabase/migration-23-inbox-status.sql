-- Shared admin inbox state for feedback and bug reports.
-- Run after migration-20-bug-reports.sql.

alter table public.feedback
  add column if not exists status text default 'unread';

update public.feedback
set status = 'unread'
where status is null;

alter table public.feedback
  alter column status set default 'unread',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_status_check'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_status_check
      check (status in ('unread', 'read', 'resolved'));
  end if;
end $$;

alter table public.bug_reports
  add column if not exists status text default 'unread';

update public.bug_reports
set status = 'unread'
where status is null;

alter table public.bug_reports
  alter column status set default 'unread',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bug_reports_status_check'
      and conrelid = 'public.bug_reports'::regclass
  ) then
    alter table public.bug_reports
      add constraint bug_reports_status_check
      check (status in ('unread', 'in_progress', 'resolved'));
  end if;
end $$;

create index if not exists feedback_unread_status_idx
  on public.feedback (status)
  where status = 'unread';

create index if not exists bug_reports_unread_status_idx
  on public.bug_reports (status)
  where status = 'unread';

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Admins can update feedback status'
  ) then
    create policy "Admins can update feedback status"
      on public.feedback for update
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bug_reports'
      and policyname = 'Admins can update bug report status'
  ) then
    create policy "Admins can update bug report status"
      on public.bug_reports for update
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

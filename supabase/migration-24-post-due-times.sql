-- Optional local wall-clock time for homework deadlines.
-- `due_at` remains a date for backwards compatibility. `due_time` is stored
-- without a timezone and interpreted in the app's APP_TIME_ZONE setting.
alter table public.posts
  add column if not exists due_time time;

comment on column public.posts.due_time is
  'Optional local deadline time, interpreted in APP_TIME_ZONE; NULL keeps date-only behavior.';

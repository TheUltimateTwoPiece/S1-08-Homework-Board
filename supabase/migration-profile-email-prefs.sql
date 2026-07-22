-- Per-user email preferences.
-- Run this in the Supabase SQL Editor. Safe additive migration.
--
-- After: each profile controls whether Brevo sends them emails for new
-- homework posts and for ad-hoc admin reminders. Defaults are TRUE — every
-- user receives emails until they opt out at /settings. New signups inherit
-- the column default automatically.

alter table public.profiles
  add column if not exists email_post_notifications boolean not null default true,
  add column if not exists email_reminder_notifications boolean not null default true;

comment on column public.profiles.email_post_notifications is
  'When false, Brevo skips the user for new-post notifications. In-app bell notifications are unaffected.';

comment on column public.profiles.email_reminder_notifications is
  'When false, Brevo skips the user for ad-hoc admin reminders. In-app bell notifications are unaffected.';

-- Backfill safety net — if a profile row somehow exists without these
-- columns populated (shouldn''t happen because of the NOT NULL DEFAULT, but
-- defensive against partial migrations), make sure everyone is opted-in.
update public.profiles
  set email_post_notifications = true
  where email_post_notifications is null;

update public.profiles
  set email_reminder_notifications = true
  where email_reminder_notifications is null;

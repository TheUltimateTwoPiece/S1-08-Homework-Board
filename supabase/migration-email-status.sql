-- Run this in the Supabase SQL Editor. Backfills-safe (all new columns are nullable).
--
-- After: every row in `public.notifications` can independently record whether its
-- Brevo email send succeeded, when, what Brevo message id it received, or what
-- error Brevo returned. The in-app notification is still saved even if email
-- fails — the columns just tell admins why each email didn't go out.

alter table public.notifications
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text,
  add column if not exists email_message_id text;

-- Admins debugging "I never got the email" will want to find the row fast.
create index if not exists notifications_email_message_id_idx
  on public.notifications (email_message_id)
  where email_message_id is not null;

create index if not exists notifications_email_sent_at_idx
  on public.notifications (email_sent_at);

comment on column public.notifications.email_sent_at is
  'When Brevo acknowledged the transactional email send for this reminder. NULL means either not yet attempted or skipped (no email address, test mode, feature disabled).';

comment on column public.notifications.email_error is
  'Last Brevo error message if email send failed. Cleared automatically when a later retry succeeds.';

comment on column public.notifications.email_message_id is
  'Brevo message id — search Brevo dashboard (Transactional → Logs) by this id to debug delivery.';

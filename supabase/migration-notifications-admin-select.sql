-- Run this once in the Supabase SQL Editor of any existing deployment.
-- Idempotent: safe to re-run without error.

-- Add the admin SELECT policy that lets PostgREST's `.insert(...).select(...)`
-- succeed when an admin inserts notifications on behalf of other users.
--
-- Why this matters:
--   schema.sql defines only "Users can view own notifications" on `notifications`
--   for SELECT:
--     create policy "Users can view own notifications"
--       on public.notifications for select to authenticated
--       using (auth.uid() = user_id);
--   When an admin sends a reminder (or a new-post fan-out, or a scheduled
--   duty reminder), the inserts target OTHER users (students), so the
--   admin's session can't SELECT the freshly inserted rows. On recent
--   PostgREST versions this triggers a rollback that surfaces to the
--   client as "new row violates row-level security policy for table
--   'notifications'" — same wording as a WITH CHECK failure, which makes
--   diagnosis hard.
--
-- Note: PostgreSQL doesn't support `if not exists` on `create policy`.
-- Wrap in a DO block that checks pg_policy for the policy's presence
-- first; the create only runs if the policy is missing.
do $$
begin
  if not exists (
    select 1
    from pg_policy
    where polname = 'Admins can view all notifications'
      and polrelid = 'public.notifications'::regclass
      and polcmd = 'r'
  ) then
    create policy "Admins can view all notifications"
      on public.notifications for select
      to authenticated
      using (public.is_admin());
  end if;
end
$$;

-- (Optional companion) post_completions already has an admin SELECT policy
-- ("Admins can view all completions") so no fix needed there.

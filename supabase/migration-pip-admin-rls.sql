-- Admin RLS policies for Pip tables.
-- Admins need read access to all users' Pip usage, chats, and messages
-- for the admin statistics page at /admin/pip-stats.

do $$
begin
  -- pip_prompts: admin can view all rows
  if not exists (
    select 1 from pg_policies
    where policyname = 'Admins can view all pip prompts'
    and tablename = 'pip_prompts'
  ) then
    create policy "Admins can view all pip prompts"
      on public.pip_prompts for select
      to authenticated
      using (public.is_admin());
  end if;

  -- pip_chats: admin can view all rows
  if not exists (
    select 1 from pg_policies
    where policyname = 'Admins can view all pip chats'
    and tablename = 'pip_chats'
  ) then
    create policy "Admins can view all pip chats"
      on public.pip_chats for select
      to authenticated
      using (public.is_admin());
  end if;

  -- pip_messages: admin can view all rows
  if not exists (
    select 1 from pg_policies
    where policyname = 'Admins can view all pip messages'
    and tablename = 'pip_messages'
  ) then
    create policy "Admins can view all pip messages"
      on public.pip_messages for select
      to authenticated
      using (public.is_admin());
  end if;
end $$;

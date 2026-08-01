-- Adds the system_instructions column to pip_chats for users who ran the
-- original migration before that column existed. Safe to run on any instance.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'pip_chats'
    and column_name = 'system_instructions'
  ) then
    alter table public.pip_chats add column system_instructions text;
  end if;
end $$;

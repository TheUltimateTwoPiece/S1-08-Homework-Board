-- Pip "last active" tracking for the admin stats page.
--
-- IMPORTANT: apply this migration BEFORE deploying the updated
-- src/app/admin/pip-stats/page.tsx, which selects the new column.
-- Running the stats code against a database without this migration makes
-- PostgREST reject the prompts query and zero out the whole page.
--
-- Previously the stats page derived a user's "last active" time only from
-- pip_chats.updated_at, which is unreliable:
--   * Deleting a chat cascade-deletes the row, erasing the user's last-active
--     signal entirely (they showed "—" despite being active).
--   * Message saves are non-critical (wrapped in try/catch), so a failed
--     write left updated_at stale even though the prompt was counted.
--
-- Every prompt attempt touches pip_prompts via pip_try_increment, so that
-- table is the correct place to stamp activity. This migration:
--   1. Adds a last_active_at timestamp column.
--   2. Stamps it on every prompt attempt (even ones rejected by the daily
--      limit, since hitting the limit is still activity).
--   3. Backfills historical rows from the most recent chat activity.

-- 1. Add the timestamp column.
alter table public.pip_prompts
  add column if not exists last_active_at timestamptz;

-- 2. Stamp it on every prompt attempt, preserving the original semantics:
--    returns the NEW count on success, or NULL when the daily limit blocks.
create or replace function public.pip_try_increment(p_date date, p_limit integer)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into public.pip_prompts (user_id, prompt_date, count, last_active_at)
  values (auth.uid(), p_date, 1, now())
  on conflict (user_id, prompt_date)
  do update set
    count = pip_prompts.count + 1,
    last_active_at = now()
  where pip_prompts.count < p_limit
  returning count into new_count;

  -- At the daily limit the upsert above is skipped; the user is still active,
  -- so stamp last_active_at anyway. new_count stays NULL, signalling "limit
  -- exceeded" exactly as before.
  if new_count is null then
    update public.pip_prompts
    set last_active_at = now()
    where user_id = auth.uid() and prompt_date = p_date;
  end if;

  return new_count;
end;
$$;

-- 3. Backfill historical rows from the most recent chat activity.
update public.pip_prompts pp
set last_active_at = c.max_updated
from (
  select user_id, max(updated_at) as max_updated
  from public.pip_chats
  group by user_id
) c
where c.user_id = pp.user_id
  and pp.last_active_at is null;

-- Harden Pip's daily rate-limit RPC.
--
-- The original function trusted caller-supplied p_date and p_limit values.
-- A user could call the public RPC directly with a future date or a much
-- larger limit and bypass the UI's daily cap. Pip uses UTC date buckets, so
-- the database now derives and validates the current UTC date and accepts
-- only the configured 100-prompt limit.

alter table public.pip_prompts
  add column if not exists last_active_at timestamptz;

create index if not exists idx_pip_prompts_prompt_date
  on public.pip_prompts (prompt_date);

-- The RPC is the only writer. Leaving the original insert/update policies in
-- place would let an authenticated user reset their own count or write a
-- future date directly through PostgREST, bypassing the 100-prompt cap.
drop policy if exists "Users can insert own pip usage" on public.pip_prompts;
drop policy if exists "Users can update own pip usage" on public.pip_prompts;
revoke insert, update, delete on table public.pip_prompts from authenticated;

create or replace function public.pip_try_increment(p_date date, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
  utc_today date := (now() at time zone 'UTC')::date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_date is distinct from utc_today then
    raise exception 'Invalid prompt date';
  end if;

  if p_limit is distinct from 100 then
    raise exception 'Invalid prompt limit';
  end if;

  insert into public.pip_prompts (user_id, prompt_date, count, last_active_at)
  values (auth.uid(), utc_today, 1, now())
  on conflict (user_id, prompt_date)
  do update set
    count = pip_prompts.count + 1,
    last_active_at = now()
  where pip_prompts.count < 100
  returning count into new_count;

  if new_count is null then
    update public.pip_prompts
       set last_active_at = now()
     where user_id = auth.uid()
       and prompt_date = utc_today;
  end if;

  return new_count;
end;
$$;

revoke all on function public.pip_try_increment(date, integer) from public;
grant execute on function public.pip_try_increment(date, integer) to authenticated;

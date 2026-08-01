-- Pip chatbot: daily prompt rate-limiting table + atomic check function.
-- Each user gets 60 prompts per day, resetting at midnight UTC.

create table if not exists public.pip_prompts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_date date not null default current_date,
  count integer not null default 0,
  primary key (user_id, prompt_date)
);

alter table public.pip_prompts enable row level security;

create policy "Users can view own pip usage"
  on public.pip_prompts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own pip usage"
  on public.pip_prompts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own pip usage"
  on public.pip_prompts for update
  to authenticated
  using (auth.uid() = user_id);

-- Atomic rate-limit check-and-increment.
-- Derives user_id from auth.uid() internally — never trusts a caller-supplied
-- parameter. Returns the NEW count after incrementing, or NULL if the limit
-- was exceeded. Prevents TOCTOU race conditions where concurrent requests
-- could all read the same count and bypass the limit.
create or replace function public.pip_try_increment(p_date date, p_limit integer)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into public.pip_prompts (user_id, prompt_date, count)
  values (auth.uid(), p_date, 1)
  on conflict (user_id, prompt_date)
  do update set count = pip_prompts.count + 1
  where pip_prompts.count < p_limit
  returning count into new_count;

  return new_count;
end;
$$;

-- Pip chatbot: persistent chats with message history.
-- Each user can have multiple chat threads, each with its own message history.

create table if not exists public.pip_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pip_chats_user_id_updated
  on public.pip_chats (user_id, updated_at desc);

alter table public.pip_chats enable row level security;

create policy "Users can view own chats"
  on public.pip_chats for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create own chats"
  on public.pip_chats for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own chats"
  on public.pip_chats for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own chats"
  on public.pip_chats for delete
  to authenticated
  using (auth.uid() = user_id);

-- pip_messages: individual messages within a chat
create table if not exists public.pip_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.pip_chats(id) on delete cascade,
  role text not null check (role in ('user', 'pip')),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pip_messages_chat_id
  on public.pip_messages (chat_id, created_at);

alter table public.pip_messages enable row level security;

create policy "Users can view own messages"
  on public.pip_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.pip_chats
      where pip_chats.id = pip_messages.chat_id
      and pip_chats.user_id = auth.uid()
    )
  );

create policy "Users can insert own messages"
  on public.pip_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.pip_chats
      where pip_chats.id = pip_messages.chat_id
      and pip_chats.user_id = auth.uid()
    )
  );

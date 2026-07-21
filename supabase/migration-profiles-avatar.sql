-- Migration: add avatar_url column to profiles + create public avatars bucket
-- with RLS so users can manage their own avatar but anyone authenticated can view
-- any avatar (they're shown on every post / comment / feedback author byline).

alter table public.profiles
  add column if not exists avatar_url text;

-- Public bucket so avatar URLs can be referenced directly without signed-URL
-- round-trips on every page render. Avatars are non-sensitive profile imagery.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'avatars');

drop policy if exists "Users can upload to own avatars folder" on storage.objects;
create policy "Users can upload to own avatars folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
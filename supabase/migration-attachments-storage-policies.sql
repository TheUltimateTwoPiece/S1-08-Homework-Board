insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated can read attachments bucket" on storage.objects;
create policy "Authenticated can read attachments bucket"
on storage.objects for select
to authenticated
using (bucket_id = 'attachments');

drop policy if exists "Authenticated can upload attachments bucket" on storage.objects;
create policy "Authenticated can upload attachments bucket"
on storage.objects for insert
to authenticated
with check (bucket_id = 'attachments' and auth.uid() = owner);

drop policy if exists "Users can delete own attachments bucket objects" on storage.objects;
create policy "Users can delete own attachments bucket objects"
on storage.objects for delete
to authenticated
using (bucket_id = 'attachments' and auth.uid() = owner);

alter table public.attachments enable row level security;

drop policy if exists "Attachments are viewable by authenticated users" on public.attachments;
create policy "Attachments are viewable by authenticated users"
on public.attachments for select
to authenticated
using (true);

drop policy if exists "Admins can add post attachments" on public.attachments;
create policy "Admins can add post attachments"
on public.attachments for insert
to authenticated
with check (public.is_admin() and auth.uid() = uploader_id and post_id is not null);

drop policy if exists "Authenticated users can add comment attachments" on public.attachments;
create policy "Authenticated users can add comment attachments"
on public.attachments for insert
to authenticated
with check (auth.uid() = uploader_id and comment_id is not null);

drop policy if exists "Users can delete own attachments" on public.attachments;
create policy "Users can delete own attachments"
on public.attachments for delete
to authenticated
using (auth.uid() = uploader_id);

drop policy if exists "Admins can delete any attachments" on public.attachments;
create policy "Admins can delete any attachments"
on public.attachments for delete
to authenticated
using (public.is_admin());


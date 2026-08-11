-- Add optional mini checklists to homework posts.
-- Run this migration in Supabase before publishing the checklist UI.
-- Existing posts receive an empty checklist and remain unchanged.

alter table public.posts
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.posts
  drop constraint if exists posts_checklist_valid;

alter table public.posts
  add constraint posts_checklist_valid
  check (
    jsonb_typeof(checklist) = 'array'
    and jsonb_array_length(checklist) <= 12
  );

-- Reclassify any post whose subject is not in the new allowlist.
--
-- Why this runs before adding the constraint: a CHECK constraint added
-- via `ALTER TABLE ... ADD CONSTRAINT` validates every existing row, not
-- just future inserts. Older posts in the codebase were stored with
-- silly/legacy values ('History', 'Language') under the original
-- unrestricted `subject text` column. Pushing them into 'Humanities' /
-- 'English' preserves intent (History → Humanities, Language → English)
-- before the constraint kicks in, so the migration doesn't fail.
--
-- 'General' was the original column default, so many existing rows
-- already have to be allowed back, not collapsed.
update public.posts
set subject = 'Humanities'
where subject = 'History';

update public.posts
set subject = 'English'
where subject = 'Language';

-- Belt-and-braces: any leftover out-of-allowlist value (typos,
-- capitalisation drift, anything a developer typed manually) gets
-- collapsed to 'General' as the safest catch-all.
update public.posts
set subject = 'General'
where subject not in (
  'English',
  'Math',
  'Science',
  'Humanities',
  'ChangeMakers Safety & Wellness',
  'CCE',
  'General'
);

-- Drop any half-applied constraint from earlier attempts, then add the
-- canonical one. Allowlist mirrors SUBJECTS in src/lib/subjects.ts;
-- update BOTH files if you ever add a new subject.
alter table public.posts
  drop constraint if exists posts_subject_check;

alter table public.posts
  add constraint posts_subject_check
  check (subject in (
    'English',
    'Math',
    'Science',
    'Humanities',
    'ChangeMakers Safety & Wellness',
    'CCE',
    'General'
  ));

-- New posts default to 'English' (matches the first item in
-- src/lib/subjects.ts and DEFAULT_SUBJECT). Existing rows are unaffected.
alter table public.posts
  alter column subject set default 'English';

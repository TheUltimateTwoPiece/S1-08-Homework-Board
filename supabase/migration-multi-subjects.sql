-- Allow a post to belong to more than one subject at once.
--
-- `posts.subject` changes from a single `text` value to a `text[]` array so
-- admins can tag a post with several subjects (e.g. a cross-curricular
-- project in Math + Science). Every consumer reads the array — progress bars
-- count a multi-subject post toward EACH of its subjects, and the subject
-- filter on /posts matches a post if ANY of its subjects match.
--
-- Existing rows are migrated by wrapping the single value in a one-element
-- array, so no data is lost. The allowlist below mirrors SUBJECTS in
-- src/lib/subjects.ts — update BOTH files if you ever add a new subject.

-- 1. Drop the old scalar check constraint BEFORE the type change — the
--    `subject in (...)` operator doesn't exist for arrays.
alter table public.posts
  drop constraint if exists posts_subject_check;

-- 2. Drop the scalar default so the column type can be converted cleanly.
alter table public.posts
  alter column subject drop default;

-- 3. Convert existing scalar values into one-element arrays.
alter table public.posts
  alter column subject type text[] using array[subject];

-- 4. Re-apply the allowlist as an array containment check: non-empty and
--    every element must be one of the canonical subjects.
alter table public.posts
  add constraint posts_subject_check
  check (
    cardinality(subject) > 0
    and subject <@ array[
      'English',
      'Math',
      'Science',
      'Humanities',
      'ChangeMakers',
      'Safety & Wellness',
      'CCE',
      'General'
    ]::text[]
  );

-- 5. Default to the canonical first subject (mirrors DEFAULT_SUBJECT in
--    src/lib/subjects.ts).
alter table public.posts
  alter column subject set default array['English'];

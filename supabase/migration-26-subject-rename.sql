-- Rename the 'Safety & Wellness' subject to 'Sports & Wellness'.
--
-- The school's official subject name is 'Sports & Wellness'; the previous
-- label was a mistake that leaked into the shared subject list and existing
-- homework posts. This migration:
--   1. Rewrites the value inside every post's subject array.
--   2. Collapses any leftover legacy 'ChangeMakers Safety & Wellness'
--      combined value to 'ChangeMakers' (belt-and-braces for deployments
--      that haven't run the older split/repair migrations).
--   3. Re-applies the posts_subject_check constraint with the new allowlist,
--      mirroring SUBJECTS in src/lib/subjects.ts.

update public.posts
set subject = array_replace(subject, 'Safety & Wellness', 'Sports & Wellness');

update public.posts
set subject = array_replace(subject, 'ChangeMakers Safety & Wellness', 'ChangeMakers');

-- Drop and re-add the canonical constraint. Allowlist mirrors SUBJECTS in
-- src/lib/subjects.ts; update BOTH files if you ever add a new subject.
alter table public.posts
  drop constraint if exists posts_subject_check;

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
      'Sports & Wellness',
      'CCE',
      'General'
    ]::text[]
  );

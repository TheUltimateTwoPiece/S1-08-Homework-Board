-- Split the combined subject into two separate subjects.
--
-- Previously a single subject 'ChangeMakers Safety & Wellness' was used;
-- the school treats 'ChangeMakers' and 'Safety & Wellness' as two
-- distinct subjects. This migration:
--   1. Reclassifies existing posts carrying the old combined value to
--      'ChangeMakers' (the primary subject; adjust the UPDATE below if
--      any of those posts should instead be 'Safety & Wellness').
--   2. Re-applies the posts_subject_check constraint with the new
--      allowlist, mirroring SUBJECTS in src/lib/subjects.ts.

update public.posts
set subject = 'ChangeMakers'
where subject = 'ChangeMakers Safety & Wellness';

-- Drop and re-add the canonical constraint. Allowlist mirrors SUBJECTS in
-- src/lib/subjects.ts; update BOTH files if you ever add a new subject.
alter table public.posts
  drop constraint if exists posts_subject_check;

alter table public.posts
  add constraint posts_subject_check
  check (subject in (
    'English',
    'Math',
    'Science',
    'Humanities',
    'ChangeMakers',
    'Safety & Wellness',
    'CCE',
    'General'
  ));

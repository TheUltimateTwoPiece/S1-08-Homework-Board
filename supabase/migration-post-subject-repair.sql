-- Repair migration for deployments affected by the merged multi-subject
-- posting change.
--
-- IMPORTANT: Run this new migration on an existing deployment. Do not rely
-- on editing or re-running older migrations that may already be recorded as
-- applied by your migration tool.

DO $$
DECLARE
  subject_type text;
BEGIN
  SELECT c.udt_name
    INTO subject_type
    FROM information_schema.columns AS c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'posts'
     AND c.column_name = 'subject';

  IF subject_type = 'text' THEN
    -- The old scalar check must be removed before changing the column type.
    ALTER TABLE public.posts
      DROP CONSTRAINT IF EXISTS posts_subject_check;

    UPDATE public.posts
       SET subject = CASE subject
         WHEN 'History' THEN 'Humanities'
         WHEN 'Language' THEN 'English'
         WHEN 'ChangeMakers Safety & Wellness' THEN 'ChangeMakers'
         WHEN 'English' THEN 'English'
         WHEN 'Math' THEN 'Math'
         WHEN 'Science' THEN 'Science'
         WHEN 'Humanities' THEN 'Humanities'
         WHEN 'ChangeMakers' THEN 'ChangeMakers'
         WHEN 'Safety & Wellness' THEN 'Safety & Wellness'
         WHEN 'CCE' THEN 'CCE'
         WHEN 'General' THEN 'General'
         ELSE 'General'
       END;

    ALTER TABLE public.posts
      ALTER COLUMN subject DROP DEFAULT;

    ALTER TABLE public.posts
      ALTER COLUMN subject TYPE text[] USING ARRAY[subject];
  ELSIF subject_type IS NULL THEN
    RAISE EXCEPTION 'public.posts.subject does not exist';
  ELSIF subject_type <> '_text' THEN
    RAISE EXCEPTION 'Unsupported public.posts.subject type: %', subject_type;
  END IF;
END
$$;

-- Replace the old combined label and remove invalid/duplicate values from
-- array-based deployments. Every post retains at least one valid subject.
UPDATE public.posts
   SET subject = array_replace(subject, 'ChangeMakers Safety & Wellness', 'ChangeMakers');

UPDATE public.posts
   SET subject = COALESCE(
     (
       SELECT array_agg(item.subject_value ORDER BY item.subject_value)
         FROM (
           SELECT DISTINCT value AS subject_value
             FROM unnest(public.posts.subject) AS item(value)
            WHERE value IN (
              'English',
              'Math',
              'Science',
              'Humanities',
              'ChangeMakers',
              'Safety & Wellness',
              'CCE',
              'General'
            )
         ) AS item
     ),
     ARRAY['General']::text[]
   );

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_subject_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_subject_check
  CHECK (
    cardinality(subject) > 0
    AND subject <@ ARRAY[
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

ALTER TABLE public.posts
  ALTER COLUMN subject SET DEFAULT ARRAY['English']::text[];

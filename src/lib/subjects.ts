// Single source of truth for the homework subject list.
//
// Every UI dropdown (CreatePostForm, EditPostForm, PostFiltersBar — passed
// from app/posts/page.tsx) and every fallback that needs a "no subject
// selected" default (createPost / updatePost / fanOutPostNotifications /
// your-progress subject breakdown) imports from here so the list lives in
// exactly one place.
//
// Order is canonical for S1-08 — keep it stable; do not alphabetise.
// "General" is intentionally kept at the end as the catch-all default
// for posts that don't fit a specific subject. ALL values below — General
// included — are accepted by the database constraint in supabase/schema.sql
// and propagated by supabase/migration-update-subjects.sql.
// Existing posts that still carry legacy values ('History', 'Language')
// were reclassified on migration to 'Humanities' / 'English' respectively
// (see the migration file) so the constraint can apply cleanly.
export const SUBJECTS = [
  "English",
  "Math",
  "Science",
  "Humanities",
  "ChangeMakers",
  "Safety & Wellness",
  "CCE",
  "General",
] as const;

export type Subject = (typeof SUBJECTS)[number];

// Used as a fallback when form data is missing a subject, and as the
// default value for the <select> in CreatePostForm. Picked as the first
// item in the canonical ordering rather than a separate constant to keep
// the list of authoritative subjects in one place.
export const DEFAULT_SUBJECT: Subject = SUBJECTS[0];

export function isSubject(value: unknown): value is Subject {
  return typeof value === "string" && (SUBJECTS as readonly string[]).includes(value);
}

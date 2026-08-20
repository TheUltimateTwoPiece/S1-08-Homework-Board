export type UserRole = "student" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  /**
   * When true, the user receives a transactional email for every new
   * homework post. In-app (bell icon) notifications are unaffected — they
   * always fire regardless of this flag. Defaults to `true`; toggled by the
   * user at /settings.
   */
  email_post_notifications: boolean;
  /**
   * When true, the user receives a transactional email when an admin sends
   * an ad-hoc reminder from /admin. In-app notifications are unaffected.
   * Defaults to `true`; toggled by the user at /settings.
   */
  email_reminder_notifications: boolean;
};

export type ChecklistItem = {
  id: string;
  text: string;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  checklist: ChecklistItem[];
  /** A post can belong to multiple subjects at once — always ≥ 1 element. */
  subject: string[];
  due_at: string | null;
  /** Optional local wall-clock deadline interpreted in APP_TIME_ZONE. */
  due_time: string | null;
  pinned: boolean;
  comments_locked: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, "full_name" | "avatar_url">;
};

export type Comment = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "avatar_url">;
};

export type Attachment = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  uploader_id: string;
  bucket: string;
  path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type PostEdit = {
  id: string;
  post_id: string;
  edited_by: string;
  changes: Record<string, unknown>;
  created_at: string;
};

export type Feedback = {
  id: string;
  author_id: string;
  category: "post" | "website";
  message: string;
  status: "unread" | "read" | "resolved";
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "email" | "avatar_url">;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  created_by: string;
  read_at: string | null;
  created_at: string;
  /**
   * When Brevo acknowledged the transactional email send. NULL when:
   * (a) the recipient had no email on file,
   * (b) Brevo was not configured on the server,
   * (c) the email send failed,
   * (d) the feature is disabled.
   */
  email_sent_at: string | null;
  /**
   * Brevo message id. Search Brevo dashboard (Transactional → Logs) by this
   * id to debug delivery complaints.
   */
  email_message_id: string | null;
  /**
   * Last Brevo error message if the email send failed. Cleared automatically
   * if a later retry succeeds.
   */
  email_error: string | null;
};

export type PostCompletion = {
  id: string;
  post_id: string;
  user_id: string;
  completed_at: string;
};

export type AdminSchedule = {
  id: string;
  admin_id: string;
  day_of_week: number;
  is_active: boolean;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "avatar_url">;
};

export type AdminDutyLog = {
  id: string;
  admin_id: string;
  scheduled_date: string;
  completed_post: boolean;
  completed_at: string | null;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "avatar_url">;
};

/**
 * Normalises a post row from Supabase so that `subject` is guaranteed to be a
 * `string[]`. The database migration converts the legacy `text` column to a
 * `text[]` array, but PostgREST may still return a plain string for rows that
 * haven't been re-saved since the migration.
 */
export function normalizeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): ChecklistItem[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { id?: unknown; text?: unknown };
    if (typeof candidate.text !== "string" || !candidate.text.trim()) return [];
    return [{
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : crypto.randomUUID(),
      text: candidate.text.trim(),
    }];
  });
}

export function normalizePost<T extends { subject: unknown }>(
  post: T,
): Omit<T, "subject"> & { subject: string[]; checklist: ChecklistItem[]; due_time: string | null } {
  const raw = (post as Record<string, unknown>).subject;
  let subject: string[];
  if (Array.isArray(raw)) {
    subject = raw.filter((value): value is string => typeof value === "string");
  } else if (typeof raw === "string") {
    subject = [raw];
  } else {
    subject = [];
  }
  const rawDueTime = (post as Record<string, unknown>).due_time;
  return {
    ...post,
    subject,
    checklist: normalizeChecklist((post as Record<string, unknown>).checklist),
    due_time: typeof rawDueTime === "string" ? rawDueTime : null,
  };
}
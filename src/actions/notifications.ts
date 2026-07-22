"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isEmailConfigured,
  processInBatches,
  renderPostEmail,
  renderReminderEmail,
  sendReminderEmail,
} from "@/lib/brevo";

type Recipient = {
  id: string;
  email: string;
  full_name: string;
};

// Opt-out flags are looked up in a separate tolerant query after
// notifications are inserted — see optedOutUserIds Sets below. Keeping
// the flag off this type prevents accidental reads from a stale query
// result that doesn't include the opt-out column.

type PostRecipient = {
  id: string;
  email: string;
  full_name: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
};

/**
 * Fans out new-post notifications + emails to every opted-in profile (both
 * students and admins), excluding the post author themselves.
 *
 * Best-effort contract:
 *   - Always inserts one row per recipient in `notifications` so the in-app
 *     bell surfaces the new post even if Brevo is down or env vars are
 *     missing.
 *   - Sends one Brevo email per opt-in recipient, recording per-row status
 *     in `email_sent_at` / `email_error` / `email_message_id`.
 *
 * Failure modes are soft — `createPost` already saved the row + attachments,
 * so the worst case for a failure here is "in-app notification appears but
 * email didn't" (which the user can see and admins can debug from the row).
 */
export async function notifyNewPost(params: {
  postId: string;
  postTitle: string;
  postSubject: string;
  postDueAt: string | null;
  authorId: string;
}) {
  const supabase = await createClient();

  // Pull candidates: students + admins (everyone who could plausibly want to
  // know about a new homework post). Excludes the author. We deliberately
  // omit `email_post_notifications` from this SELECT so the query still
  // succeeds on installs where migration-profile-email-prefs.sql hasn't run
  // (the column doesn't exist yet → PostgREST errors the whole SELECT,
  // data: null, candidates = []). Opt-out flags are looked up later in a
  // separate tolerant query.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .neq("id", params.authorId);

  const candidates = (profiles as PostRecipient[] | null) ?? [];

  // In-app notifications go to EVERYONE (admins and students alike — the
  // bell icon is the consistent UX regardless of email opt-in).
  if (candidates.length === 0)
    return {
      inAppCount: 0,
      emailedCount: 0,
      failedCount: 0,
      testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
      testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
    };

  const rowsToInsert = candidates.map((c) => ({
    user_id: c.id,
    title: `New homework: ${params.postTitle}`,
    message: params.postDueAt
      ? `A new ${params.postSubject} assignment is posted, due ${params.postDueAt}.`
      : `A new ${params.postSubject} assignment is posted.`,
    created_by: params.authorId,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("notifications")
    .insert(rowsToInsert)
    .select("id, user_id");

  if (insertError) {
    // Don't throw — createPost already persisted the post. The user just
    // won't get in-app notifications for this one. Return shape stays
    // consistent so callers can swallow the error cleanly.
    return {
      inAppCount: 0,
      emailedCount: 0,
      failedCount: 0,
      error: insertError.message,
      testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
      testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
    };
  }

  const notifications = (inserted as NotificationRow[] | null) ?? [];
  const profileById = new Map(candidates.map((c) => [c.id, c]));

  // Tolerant opt-out lookup. If migration-profile-email-prefs.sql hasn't
  // run, this query errors with the schema-cache message and we fall
  // through treating every recipient as opted-in — matches the column
  // default of `true` and lets un-migrated installs still send happy-path
  // emails without the opt-out feature.
  const optedOutUserIds = new Set<string>();
  if (notifications.length > 0) {
    const { data: optOuts, error: optOutsError } = await supabase
      .from("profiles")
      .select("id, email_post_notifications")
      .in(
        "id",
        notifications.map((n) => n.user_id),
      );
    if (!optOutsError && optOuts) {
      for (const row of optOuts as Array<{
        id: string;
        email_post_notifications: boolean | null;
      }>) {
        if (row.email_post_notifications === false) {
          optedOutUserIds.add(row.id);
        }
      }
    }
    // optOutsError → optedOutUserIds stays empty; everyone opt-in.
  }

  // Email recipients are a strict subset: post-notification opt-ins only.
  // Opted-out recipients still get the in-app notification (inserted above);
  // they get a skip-marker on `email_error` here so admins see a consistent
  // "Skipped" badge in /notifications — same pattern as sendReminder uses
  // for `email_reminder_notifications`.
  const optedOutIds: string[] = [];
  const emailQueue = notifications
    .map((n) => {
      const profile = profileById.get(n.user_id);
      if (!profile) return null;
      if (optedOutUserIds.has(n.user_id)) {
        optedOutIds.push(n.id);
        return null;
      }
      return {
        notificationId: n.id,
        email: profile.email,
        fullName: profile.full_name,
      };
    })
    .filter(
      (q): q is {
        notificationId: string;
        email: string;
        fullName: string;
      } => q !== null,
    );

  // Record the opted-out state on each row so admins debugging "why didn't
  // X get an email?" see the reason on the per-row badge tooltip.
  if (optedOutIds.length > 0) {
    await supabase
      .from("notifications")
      .update({
        email_error: "Skipped — recipient opted out of new-post emails.",
      })
      .in("id", optedOutIds);
  }

  // Author record for the email template's "X just posted" copy.
  const { data: authorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", params.authorId)
    .single();
  const authorName =
    (authorProfile as { full_name?: string } | null)?.full_name ?? "Your teacher";

  // No Brevo configured — record a config error on every email recipient row
  // so the per-row badge explains why nothing went out.
  if (!isEmailConfigured() || emailQueue.length === 0) {
    if (emailQueue.length > 0) {
      await supabase
        .from("notifications")
        .update({
          email_error:
            "Email not sent — Brevo API key / from-address not configured on server.",
        })
        .in(
          "id",
          emailQueue.map((q) => q.notificationId),
        );
    }

    revalidateReminderViews();
    return {
      inAppCount: notifications.length,
      emailedCount: 0,
      failedCount: emailQueue.length,
      testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
      testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
    };
  }

  // One-time test-mode warning per fan-out, logged at the action layer with
  // full context (recipient count + source post title). The Brevo wrapper
  // no longer warns per-email, so 24-line spam in Vercel → Logs is gone.
  if (process.env.BREVO_TEST_TO_EMAIL) {
    console.warn(
      `[brevo] TEST MODE REDIRECT to ${process.env.BREVO_TEST_TO_EMAIL} — new-post fan-out for "${params.postTitle}" is rerouting all ${emailQueue.length} emails. ` +
      `Disable by removing BREVO_TEST_TO_EMAIL from env vars (Vercel → Settings → Environment Variables, or .env.local).`,
    );
  }

  // Phase 1 — fan out emails in chunks of 5 to stay under Brevo's per-second
  //           rate limit. No DB writes inside the worker — just the HTTP call.
  const outcomes = await processInBatches(
    emailQueue,
    5,
    async (q): Promise<EmailOutcome> => {
      const html = renderPostEmail({
        recipientName: q.fullName,
        postTitle: params.postTitle,
        authorName,
        subject: params.postSubject,
        dueAt: params.postDueAt,
        postId: params.postId,
      });

      const result = await sendReminderEmail({
        to: q.email,
        toName: q.fullName,
        subject: `New homework posted: ${params.postTitle}`,
        htmlContent: html,
        tag: `new-post-${params.postId}`,
      });

      if (result.ok) {
        return {
          notificationId: q.notificationId,
          ok: true,
          messageId: result.messageId,
        };
      } else {
        return {
          notificationId: q.notificationId,
          ok: false,
          error: result.error,
        };
      }
    },
  );

  // Phase 2 — parallel DB writes of the per-row status. Same pattern as
  //           sendReminder to keep DB time at one round trip instead of N.
  const sentAt = new Date().toISOString();
  await Promise.all(
    outcomes.map((o) => {
      if (o.ok) {
        return supabase
          .from("notifications")
          .update({
            email_sent_at: sentAt,
            email_message_id: o.messageId ?? null,
            email_error: null,
          })
          .eq("id", o.notificationId);
      } else {
        return supabase
          .from("notifications")
          .update({ email_error: o.error ?? "Unknown error" })
          .eq("id", o.notificationId);
      }
    }),
  );

  let emailedCount = 0;
  let failedCount = 0;
  for (const o of outcomes) {
    if (o.ok) emailedCount++;
    else failedCount++;
  }

  revalidateReminderViews();

  return {
    inAppCount: notifications.length,
    emailedCount,
    failedCount,
    testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
    testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
  };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: senderProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
  ]);

  if (profile?.role !== "admin") redirect("/");

  return {
    supabase,
    user,
    senderName: senderProfile?.full_name ?? "Your teacher",
  };
}

function revalidateReminderViews() {
  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/");
}

type EmailOutcome = {
  notificationId: string;
  ok: boolean;
  messageId?: string;
  error?: string;
};

// Diagnostic counts captured by the "incomplete" target branch so the
// empty-candidates error can tell the admin WHY nothing was found — was it
// because there are no student accounts, or because every student has
// already completed the post? Without this the error reads as a silent
// refusal and admins can't tell whether to retry or give up.
// (Scoping note: these must stay inside sendReminder, not module scope —
// Vercel re-uses warm server-action instances across requests, and a
// module-level `let` would leak counter state from request A into B.)

export async function sendReminder(formData: FormData) {
  const { supabase, user, senderName } = await requireAdmin();

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";
  const target = (formData.get("target") as string | null) ?? "";
  const postId = (formData.get("postId") as string | null) || null;

  if (!title || !message) {
    return { success: false, error: "Title and message are required." };
  }
  if (!target) {
    return { success: false, error: "Please pick whom to send this reminder to." };
  }

  let candidates: Recipient[] = [];
  let labelPrefix = "to send the reminder to";
  // Populated only by the "incomplete" branch; consumed in the empty-
  // candidates error path below to render a diagnostic message.
  let incompleteStudentCount = 0;
  let incompleteCompletedCount = 0;

  if (target === "all") {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "student")
      .order("full_name");
    candidates = (data as Recipient[] | null) ?? [];
  } else if (target === "all-admins") {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "admin")
      .order("full_name");
    candidates = (data as Recipient[] | null) ?? [];
  } else if (target === "incomplete") {
    if (!postId) {
      return {
        success: false,
        error: "Please select a post to filter by incomplete students.",
      };
    }

    const [{ data: students }, { data: completions }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("role", "student"),
      supabase
        .from("post_completions")
        .select("user_id")
        .eq("post_id", postId),
    ]);

    const studentRows = (students as Recipient[] | null) ?? [];
    const completedIds = new Set(
      (completions as { user_id: string }[] | null)?.map((c) => c.user_id) ?? [],
    );
    candidates = studentRows.filter((s) => !completedIds.has(s.id));
    labelPrefix = "that still needs to be completed";
    incompleteStudentCount = studentRows.length;
    incompleteCompletedCount = completedIds.size;
  } else {
    // Single recipient by id — admin or student
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", target)
      .single();
    candidates = data ? [data as Recipient] : [];
  }

  // Self-filter (defence in depth — admins shouldn't email their own in-app
  // reminder back to themselves when targeting role-wide lists. Single-id
  // targets are preserved so admins can deliberately notify themselves.)
  const selfFiltered =
    target === "all-admins"
      ? candidates.filter((c) => c.id !== user.id)
      : candidates;

  if (selfFiltered.length === 0) {
    let label: string;
    if (target === "all-admins") {
      label = "No other admins found to remind.";
    } else if (target === "incomplete") {
      // Tell the admin exactly why the candidates list is empty so they
      // can tell "no student accounts" apart from "every student already
      // completed this post". Without this the empty list reads as a
      // silent refusal.
      if (incompleteStudentCount === 0) {
        label =
          "No student accounts found. Sign students up first, then send your reminder.";
      } else if (incompleteCompletedCount === incompleteStudentCount) {
        const n = incompleteStudentCount;
        label = `All ${n} student${n === 1 ? "" : "s"} already completed this post — nothing left to remind.`;
      } else {
        label = `No incomplete students found for this post.`;
      }
    } else if (target === "all") {
      label = "No student accounts found. Sign students up first.";
    } else {
      label = `No recipients ${labelPrefix}.`;
    }
    return { success: false, error: label };
  }

  // Look up the post title (for the email body, optional CTA link).
  let postTitle: string | null = null;
  if (postId) {
    const { data: post } = await supabase
      .from("posts")
      .select("title")
      .eq("id", postId)
      .single();
    postTitle = (post as { title?: string } | null)?.title ?? null;
  }

  // Insert notifications, RETURNING ids so we can update each row with its
  // email status afterwards. Supabase's `.insert(rows).select()` issues a
  // single round trip — PostgREST returns the inserted rows including the
  // server-generated `id` column.
  const rowsToInsert = selfFiltered.map((c) => ({
    user_id: c.id,
    title,
    message,
    created_by: user.id,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("notifications")
    .insert(rowsToInsert)
    .select("id, user_id");

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  const notifications = (inserted as NotificationRow[] | null) ?? [];

  if (notifications.length === 0) {
    return {
      success: false,
      error: "Reminder could not be saved.",
    };
  }

  // Tolerant opt-out lookup. The candidate SELECTs above intentionally omit
  // `email_reminder_notifications` so an un-migrated install (where the
  // migration-profile-email-prefs.sql columns don't exist) still returns
  // a valid candidate list. We re-fetch opt-out flags here for the IDs we
  // actually sent notifications to; if the column doesn't exist, this
  // errors with the schema-cache message and we fall through treating
  // every recipient as opted-in — matching the column's default of `true`.
  const optedOutUserIds = new Set<string>();
  if (notifications.length > 0) {
    const { data: optOuts, error: optOutsError } = await supabase
      .from("profiles")
      .select("id, email_reminder_notifications")
      .in(
        "id",
        notifications.map((n) => n.user_id),
      );
    if (!optOutsError && optOuts) {
      for (const row of optOuts as Array<{
        id: string;
        email_reminder_notifications: boolean | null;
      }>) {
        if (row.email_reminder_notifications === false) {
          optedOutUserIds.add(row.id);
        }
      }
    }
    // optOutsError → keep optedOutUserIds empty; everyone treated as opt-in.
  }

  // Build the per-recipient send queue: notificationId ↔ profile row.
  // Honor the recipient's email-preference opt-out here — they still get the
  // in-app notification (inserted above) but no email is fetched for them.
  const profileById = new Map(selfFiltered.map((c) => [c.id, c]));
  const optedOut: string[] = [];
  const sendQueue = notifications
    .map((n) => {
      const profile = profileById.get(n.user_id);
      if (!profile) return null;
      if (optedOutUserIds.has(n.user_id)) {
        optedOut.push(n.id);
        return null;
      }
      return {
        notificationId: n.id,
        email: profile.email,
        fullName: profile.full_name,
      };
    })
    .filter(
      (q): q is {
        notificationId: string;
        email: string;
        fullName: string;
      } => q !== null,
    );

  // Record the opted-out state on each row so admins debugging "why didn't
  // X get an email?" see the reason on the per-row badge tooltip.
  if (optedOut.length > 0) {
    await supabase
      .from("notifications")
      .update({ email_error: "Skipped — recipient opted out of reminder emails." })
      .in("id", optedOut);
  }

  // If Brevo isn't configured, short-circuit: every notification has its
  // email_error set to a config message, in-app delivery counts as success.
  if (!isEmailConfigured()) {
    await supabase
      .from("notifications")
      .update({
        email_error:
          "Email not sent — Brevo API key / from-address not configured on server.",
      })
      .in(
        "id",
        notifications.map((n) => n.id),
      );

    revalidateReminderViews();
    return {
      success: true,
      inAppCount: notifications.length,
      emailedCount: 0,
      failedCount: notifications.length,
      testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
      testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
      errors: [
        "Email service not configured (set BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME on Vercel).",
      ],
    };
  }  // One-time test-mode warning per fan-out, logged at the action layer with
  // full context (recipient count + reminder title). The Brevo wrapper no
  // longer warns per-email, so 24-line spam in Vercel → Logs is gone.
  if (process.env.BREVO_TEST_TO_EMAIL) {
    console.warn(
      `[brevo] TEST MODE REDIRECT to ${process.env.BREVO_TEST_TO_EMAIL} — reminder fan-out "${title}" is rerouting all ${sendQueue.length} emails. ` +
      `Disable by removing BREVO_TEST_TO_EMAIL from env vars (Vercel → Settings → Environment Variables, or .env.local).`,
    );
  }

  // Phase 1 — fan out emails in chunks of 5 to stay under Brevo's per-second
  //           rate limit. The worker does NO database writes here — only the Brevo call
  //           and a small outcome object. Collecting outcomes before any DB write means
  //           DB updates can run in parallel next.
  const outcomes = await processInBatches(
    sendQueue,
    5,
    async (q): Promise<EmailOutcome> => {
      const html = renderReminderEmail({
        recipientName: q.fullName,
        title,
        message,
        senderName,
        postId,
        postTitle,
      });

      const subject = postTitle
        ? `Homework reminder: ${postTitle}`
        : title;

      const result = await sendReminderEmail({
        to: q.email,
        toName: q.fullName,
        subject,
        htmlContent: html,
        tag: postId ? `reminder-post-${postId}` : "reminder-general",
      });

      if (result.ok) {
        return {
          notificationId: q.notificationId,
          ok: true,
          messageId: result.messageId,
        };
      } else {
        return {
          notificationId: q.notificationId,
          ok: false,
          error: result.error,
        };
      }
    },
  );

  // Phase 2 — write all status rows in parallel. The bottleneck here is the
  //         network round-trip count when N is large; running them concurrently
  //         drops effective time from N*T to roughly one slow request.
  const sentAt = new Date().toISOString();
  await Promise.all(
    outcomes.map((o) => {
      if (o.ok) {
        return supabase
          .from("notifications")
          .update({
            email_sent_at: sentAt,
            email_message_id: o.messageId ?? null,
            email_error: null,
          })
          .eq("id", o.notificationId);
      } else {
        return supabase
          .from("notifications")
          .update({ email_error: o.error ?? "Unknown error" })
          .eq("id", o.notificationId);
      }
    }),
  );

  let emailedCount = 0;
  let failedCount = 0;
  const uniqueErrors = new Set<string>();
  for (const r of outcomes) {
    if (r.ok) emailedCount++;
    else {
      failedCount++;
      if (r.error) uniqueErrors.add(r.error);
    }
  }

  revalidateReminderViews();

  return {
    success: true,
    inAppCount: notifications.length,
    emailedCount,
    failedCount,
    testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
    testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
    errors: uniqueErrors.size > 0 ? Array.from(uniqueErrors).slice(0, 3) : undefined,
  };
}

/** @deprecated Use sendReminder */
export async function sendNotification(formData: FormData) {
  return sendReminder(formData);
}

export async function markNotificationRead(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const notificationId = formData.get("notificationId") as string;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  revalidateReminderViews();
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  revalidateReminderViews();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isEmailConfigured,
  processInBatches,
  renderReminderEmail,
  sendReminderEmail,
} from "@/lib/brevo";

type Recipient = {
  id: string;
  email: string;
  full_name: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
};

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

    const completedIds = new Set(
      (completions as { user_id: string }[] | null)?.map((c) => c.user_id) ?? [],
    );
    candidates =
      (students as Recipient[] | null)?.filter(
        (s) => !completedIds.has(s.id),
      ) ?? [];
    labelPrefix = "that still needs to be completed";
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
    const label =
      target === "all-admins"
        ? "No other admins found to remind."
        : `No recipients ${labelPrefix}.`;
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

  // Build the per-recipient send queue: notificationId ↔ profile row.
  const profileById = new Map(selfFiltered.map((c) => [c.id, c]));
  const sendQueue = notifications
    .map((n) => {
      const profile = profileById.get(n.user_id);
      if (!profile) return null;
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
      testMode: false,
      errors: [
        "Email service not configured (set BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME on Vercel).",
      ],
    };
  }

  // Phase 1 — fan out emails in chunks of 5 to stay under Brevo's per-second
  // rate limit. The worker does NO database writes here — only the Brevo call
  // and a small outcome object. Collecting outcomes before any DB write means
  // DB updates can run in parallel next.
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

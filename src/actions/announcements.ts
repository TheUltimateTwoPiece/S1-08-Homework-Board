"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isEmailConfigured,
  processInBatches,
  renderAnnouncementEmail,
  sendReminderEmail,
} from "@/lib/brevo";
import { tripProfanity } from "@/lib/profanity";

type Recipient = {
  id: string;
  email: string;
  full_name: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
};

type EmailOutcome = {
  notificationId: string;
  ok: boolean;
  messageId?: string;
  error?: string;
};

const MAX_TITLE_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 5000;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: senderProfile }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (profile?.role !== "admin") redirect("/");

  return {
    supabase,
    user,
    senderName: senderProfile?.full_name ?? "Your teacher",
  };
}

function revalidateAnnouncementViews() {
  revalidatePath("/notifications");
  revalidatePath("/admin/announcements");
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Fans out a class-wide announcement (patch notes, feature notices, etc.) to
 * every student AND admin except the sender. Always inserts in-app
 * notifications so the message lands in the bell + /notifications tab; email
 * delivery is best-effort and honors the recipient's `email_reminder_notifications`
 * opt-out (announcements are admin-initiated messages, same as reminders).
 */
export async function sendAnnouncement(formData: FormData) {
  const { supabase, user, senderName } = await requireAdmin();

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";

  if (!title || !message) {
    return { success: false, error: "Title and message are required." };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      success: false,
      error: `Title is too long (max ${MAX_TITLE_LENGTH} characters).`,
    };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
    };
  }

  // Same profanity gate as posts/comments/reminders.
  const profanity = tripProfanity({ userId: user.id }, title, message);
  if (profanity.triggered) redirect(profanity.redirectUrl);

  // Announcements reach everyone (students + admins) so patch notes and
  // feature updates aren't invisible to the other admins helping run the board.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("role", ["student", "admin"])
    .neq("id", user.id)
    .order("full_name");

  const recipients = (profiles as Recipient[] | null) ?? [];

  if (recipients.length === 0) {
    return {
      success: false,
      error: "No recipients found. Students and admins are needed first.",
    };
  }

  const rowsToInsert = recipients.map((r) => ({
    user_id: r.id,
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
    return { success: false, error: "Announcement could not be saved." };
  }

  // Tolerant opt-out lookup (mirrors sendReminder). If the email-prefs column
  // is missing, fall through treating everyone as opted-in.
  const optedOutUserIds = new Set<string>();
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

  const profileById = new Map(recipients.map((r) => [r.id, r]));
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
      (q): q is { notificationId: string; email: string; fullName: string } =>
        q !== null,
    );

  if (optedOut.length > 0) {
    await supabase
      .from("notifications")
      .update({
        email_error: "Skipped — recipient opted out of reminder emails.",
      })
      .in("id", optedOut);
  }

  if (!isEmailConfigured() || sendQueue.length === 0) {
    if (sendQueue.length > 0) {
      await supabase
        .from("notifications")
        .update({
          email_error:
            "Email not sent — Brevo API key / from-address not configured on server.",
        })
        .in(
          "id",
          sendQueue.map((q) => q.notificationId),
        );
    }

    revalidateAnnouncementViews();
    return {
      success: true,
      inAppCount: notifications.length,
      emailedCount: 0,
      failedCount: sendQueue.length,
      testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
      testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
      errors:
        sendQueue.length > 0
          ? [
              "Email service not configured (set BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME on Vercel).",
            ]
          : undefined,
    };
  }

  if (process.env.BREVO_TEST_TO_EMAIL) {
    console.warn(
      `[brevo] TEST MODE REDIRECT to ${process.env.BREVO_TEST_TO_EMAIL} — announcement "${title}" is rerouting all ${sendQueue.length} emails. ` +
        `Disable by removing BREVO_TEST_TO_EMAIL from env vars.`,
    );
  }

  const outcomes = await processInBatches(
    sendQueue,
    5,
    async (q): Promise<EmailOutcome> => {
      const html = renderAnnouncementEmail({
        recipientName: q.fullName,
        title,
        message,
        senderName,
      });

      const result = await sendReminderEmail({
        to: q.email,
        toName: q.fullName,
        subject: title,
        htmlContent: html,
        tag: "announcement",
      });

      if (result.ok) {
        return {
          notificationId: q.notificationId,
          ok: true,
          messageId: result.messageId,
        };
      }
      return {
        notificationId: q.notificationId,
        ok: false,
        error: result.error,
      };
    },
  );

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
      }
      return supabase
        .from("notifications")
        .update({ email_error: o.error ?? "Unknown error" })
        .eq("id", o.notificationId);
    }),
  );

  let emailedCount = 0;
  let failedCount = 0;
  const uniqueErrors = new Set<string>();
  for (const o of outcomes) {
    if (o.ok) emailedCount++;
    else {
      failedCount++;
      if (o.error) uniqueErrors.add(o.error);
    }
  }

  revalidateAnnouncementViews();

  return {
    success: true,
    inAppCount: notifications.length,
    emailedCount,
    failedCount,
    testMode: Boolean(process.env.BREVO_TEST_TO_EMAIL),
    testModeEmail: process.env.BREVO_TEST_TO_EMAIL ?? null,
    errors:
      uniqueErrors.size > 0 ? Array.from(uniqueErrors).slice(0, 3) : undefined,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  return { supabase, user };
}

function revalidateReminderViews() {
  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function sendReminder(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const title = (formData.get("title") as string).trim();
  const message = (formData.get("message") as string).trim();
  const target = formData.get("target") as string;
  const postId = formData.get("postId") as string | null;

  if (!title || !message) {
    return { error: "Title and message are required." };
  }

  let userIds: string[] = [];

  if (target === "all") {
    const { data: students } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student");

    userIds = students?.map((s) => s.id) ?? [];
  } else if (target === "all-admins") {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    userIds = admins?.map((a) => a.id).filter((id) => id !== user.id) ?? [];
  } else if (target === "incomplete") {
    // Send only to students who haven't completed the specified post
    if (!postId) {
      return { error: "Please select a post to filter by incomplete students." };
    }

    // Get all students
    const { data: students } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student");

    if (!students || students.length === 0) {
      return { error: "No students found." };
    }

    // Get all completions for this post
    const { data: completions } = await supabase
      .from("post_completions")
      .select("user_id")
      .eq("post_id", postId);

    const completedUserIds = new Set(completions?.map((c) => c.user_id) ?? []);

    // Filter to only students who haven't completed
    userIds = students
      .filter((s) => !completedUserIds.has(s.id))
      .map((s) => s.id);
  } else {
    // Can target a student or an admin by ID — no role filter, just validate it exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", target)
      .single();

    if (!profile) {
      return { error: "Please select a valid recipient." };
    }

    userIds = [profile.id];
  }

  if (userIds.length === 0) {
    const label =
      target === "all-admins"
        ? "No other admins found to remind."
        : "No recipients found to remind.";
    return { error: label };
  }

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    title,
    message,
    created_by: user.id,
  }));

  const { error } = await supabase.from("notifications").insert(notifications);

  if (error) {
    return { error: error.message };
  }

  revalidateReminderViews();
  return { success: true, count: userIds.length };
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

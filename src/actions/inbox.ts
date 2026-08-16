"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const FEEDBACK_STATUSES = new Set(["unread", "read", "resolved"]);
const BUG_REPORT_STATUSES = new Set(["unread", "in_progress", "resolved"]);

type InboxActionResult = { success?: boolean; error?: string };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");
  return supabase;
}

export async function setFeedbackStatus(formData: FormData): Promise<InboxActionResult> {
  const supabase = await requireAdmin();
  const feedbackId = formData.get("feedbackId");
  const status = formData.get("status");

  if (typeof feedbackId !== "string" || !feedbackId.trim()) {
    return { error: "Missing feedback item." };
  }
  if (typeof status !== "string" || !FEEDBACK_STATUSES.has(status)) {
    return { error: "Invalid feedback status." };
  }

  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", feedbackId.trim());

  if (error) return { error: error.message };

  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function setBugReportStatus(formData: FormData): Promise<InboxActionResult> {
  const supabase = await requireAdmin();
  const reportId = formData.get("reportId");
  const status = formData.get("status");

  if (typeof reportId !== "string" || !reportId.trim()) {
    return { error: "Missing bug report." };
  }
  if (typeof status !== "string" || !BUG_REPORT_STATUSES.has(status)) {
    return { error: "Invalid bug report status." };
  }

  const { error } = await supabase
    .from("bug_reports")
    .update({ status })
    .eq("id", reportId.trim());

  if (error) return { error: error.message };

  revalidatePath("/admin/bug-reports");
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

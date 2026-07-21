"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");
  return { supabase, user };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function setAdminSchedule(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const adminIdRaw = (formData.get("adminId") as string) ?? "";
  const adminId = adminIdRaw || user.id;
  const dayRaw = formData.get("dayOfWeek") as string;
  const activeRaw = formData.get("isActive") as string;
  const dayOfWeek = parseInt(dayRaw, 10);
  const isActive = activeRaw === "true";

  if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: "Invalid day of week." };
  }

  // Check if schedule already exists
  const { data: existing } = await supabase
    .from("admin_schedules")
    .select("id")
    .eq("admin_id", adminId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("admin_schedules")
      .update({ is_active: isActive })
      .eq("id", existing.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("admin_schedules").insert({
      admin_id: adminId,
      day_of_week: dayOfWeek,
      is_active: isActive,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/schedule");
  return { success: true, label: DAY_NAMES[dayOfWeek], active: isActive };
}

export async function markDutyCompleted(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const dateStr = formData.get("date") as string;
  const completed = (formData.get("completed") as string) === "true";

  const { data: existing } = await supabase
    .from("admin_duty_logs")
    .select("id")
    .eq("admin_id", user.id)
    .eq("scheduled_date", dateStr)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("admin_duty_logs")
      .update({
        completed_post: completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", existing.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("admin_duty_logs").insert({
      admin_id: user.id,
      scheduled_date: dateStr,
      completed_post: completed,
      completed_at: completed ? new Date().toISOString() : null,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/schedule");
  return { success: true };
}

export async function sendDutyReminders() {
  const { supabase, user } = await requireAdmin();

  const today = format(new Date(), "yyyy-MM-dd");
  const dayOfWeek = new Date().getDay();

  // Find all admins scheduled for today
  const { data: schedules } = await supabase
    .from("admin_schedules")
    .select("admin_id, profiles(full_name)")
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);

  if (!schedules || schedules.length === 0) {
    return { success: true, count: 0, message: "No admins scheduled today." };
  }

  const reminders: { user_id: string; title: string; message: string; created_by: string }[] = [];

  for (const schedule of schedules) {
    // Check if they already marked duty as completed
    const { data: log } = await supabase
      .from("admin_duty_logs")
      .select("id, completed_post, notified")
      .eq("admin_id", schedule.admin_id)
      .eq("scheduled_date", today)
      .maybeSingle();

    const alreadyCompleted = log?.completed_post === true;
    // Only send if not completed and not already notified
    if (!alreadyCompleted && log?.notified !== true) {
      reminders.push({
        user_id: schedule.admin_id,
        title: `Homework post due today (${DAY_NAMES[dayOfWeek]})`,
        message: `You're scheduled to create a homework post today. Please make sure to publish it and mark your duty as complete in the Schedule page.`,
        created_by: user.id,
      });

      // Mark as notified
      if (log) {
        await supabase
          .from("admin_duty_logs")
          .update({ notified: true, notified_at: new Date().toISOString() })
          .eq("id", log.id);
      } else {
        await supabase.from("admin_duty_logs").insert({
          admin_id: schedule.admin_id,
          scheduled_date: today,
          completed_post: false,
          notified: true,
          notified_at: new Date().toISOString(),
        });
      }
    }
  }

  if (reminders.length > 0) {
    const { error } = await supabase.from("notifications").insert(reminders);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/schedule");
  return {
    success: true,
    count: reminders.length,
    message: reminders.length > 0
      ? `Sent ${reminders.length} reminder(s) to scheduled admins.`
      : "All scheduled admins have already completed their posts.",
  };
}

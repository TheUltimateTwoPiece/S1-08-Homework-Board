import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AdminScheduleClient } from "./AdminScheduleClient";
import type { AdminSchedule } from "@/lib/types";

export const revalidate = 15;

export default async function AdminSchedulePage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dayOfWeek = new Date().getDay();

  // Fetch all admin schedules with admin profile info
  const { data: schedules } = await supabase
    .from("admin_schedules")
    .select("*, profiles(full_name)")
    .order("admin_id")
    .order("day_of_week");

  const typedSchedules = (schedules as (AdminSchedule & { profiles: { full_name: string } })[]) ?? [];

  // Get all admins for the schedule form
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "admin")
    .order("full_name");

  // Get today's duty logs
  const { data: todayLogs } = await supabase
    .from("admin_duty_logs")
    .select("admin_id, completed_post")
    .eq("scheduled_date", todayStr);

  const completedToday = new Set(
    (todayLogs ?? [])
      .filter((l) => l.completed_post)
      .map((l) => l.admin_id)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <h1 className="hb-page-title text-2xl tracking-tight">Admin Schedule</h1>
            <p className="hb-body-text mt-0.5 text-sm">
              Assign admins to days of the week for creating homework posts.
            </p>
          </div>
        </div>
      </div>

      <AdminScheduleClient
        schedules={typedSchedules}
        admins={(admins ?? []) as { id: string; full_name: string; email: string }[]}
        todayStr={todayStr}
        dayOfWeek={dayOfWeek}
        completedToday={Array.from(completedToday)}
      />
    </div>
  );
}

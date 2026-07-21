import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { PostsWidget } from "@/components/dashboard/PostsWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { StatsWidget } from "@/components/dashboard/StatsWidget";
import { UpcomingWidget } from "@/components/dashboard/UpcomingWidget";
import { NotificationsWidget } from "@/components/dashboard/NotificationsWidget";
import { DutyWidget } from "@/components/dashboard/DutyWidget";
import { FeedbackWidget } from "@/components/dashboard/FeedbackWidget";
import type { AdminSchedule, Feedback, Notification, Post } from "@/lib/types";

export const revalidate = 30;

type DutyLogRow = { admin_id: string; completed_post: boolean };
type ScheduleRow = AdminSchedule & { profiles: { full_name: string } | null };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dayOfWeek = new Date().getDay();
  const isAdmin = profile.role === "admin";

  const [
    { data: posts },
    { data: completions },
    { data: notifications },
    schedulesResult,
    todayLogsResult,
    feedbackResult,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("*, profiles(full_name, avatar_url)")
      .order("pinned", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("post_completions")
      .select("post_id")
      .eq("user_id", profile.id),
    supabase
      .from("notifications")
      .select("id, user_id, title, message, created_by, read_at, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(3),
    isAdmin
      ? supabase
          .from("admin_schedules")
          .select("*, profiles(full_name, avatar_url)")
          .order("admin_id")
          .order("day_of_week")
      : Promise.resolve({ data: [] as unknown as ScheduleRow[] }),
    isAdmin
      ? supabase
          .from("admin_duty_logs")
          .select("admin_id, completed_post")
          .eq("scheduled_date", todayStr)
      : Promise.resolve({ data: [] as unknown as DutyLogRow[] }),
    isAdmin
      ? supabase
          .from("feedback")
          .select("*, profiles(full_name, email, avatar_url)")
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as unknown as Feedback[] }),
  ]);

  const typedPosts = (posts as Post[]) ?? [];
  const completedSet = new Set<string>(
    (completions ?? []).map((c) => c.post_id as string),
  );

  const sortedPosts = [...typedPosts].sort((a, b) => {
    const aDone = completedSet.has(a.id) ? 1 : 0;
    const bDone = completedSet.has(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.due_at !== b.due_at) {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalPosts = typedPosts.length;
  const completedCount = typedPosts.filter((p) => completedSet.has(p.id)).length;
  const upcomingCount = typedPosts.filter(
    (p) => p.due_at && p.due_at >= todayStr,
  ).length;
  const overdueCount = typedPosts.filter(
    (p) => p.due_at && p.due_at < todayStr,
  ).length;

  const allSchedules = (schedulesResult.data as ScheduleRow[]) ?? [];
  const todaySchedules = allSchedules.filter(
    (s) => s.day_of_week === dayOfWeek && s.is_active,
  );
  const completedToday = ((todayLogsResult.data as DutyLogRow[]) ?? [])
    .filter((l) => l.completed_post)
    .map((l) => l.admin_id);

  const feedback = (feedbackResult.data as Feedback[]) ?? [];
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle={`It's ${format(new Date(), "EEEE, MMMM d")}. Here's your homework dashboard.`}
        showAdminCta
      />

      <div className="hb-bento">
        <PostsWidget
          posts={sortedPosts}
          completedSet={completedSet}
          firstName={firstName}
        />
        <CalendarWidget posts={typedPosts} />
        <StatsWidget
          totalPosts={totalPosts}
          completedCount={completedCount}
          upcomingCount={upcomingCount}
          overdueCount={overdueCount}
        />
        <UpcomingWidget posts={sortedPosts} />
        <NotificationsWidget
          notifications={(notifications as Notification[]) ?? []}
        />
        {isAdmin && (
          <>
            <DutyWidget
              todaySchedules={todaySchedules}
              completedToday={completedToday}
              todayStr={todayStr}
              currentAdminId={profile.id}
            />
            <FeedbackWidget feedback={feedback} />
          </>
        )}
      </div>
    </div>
  );
}

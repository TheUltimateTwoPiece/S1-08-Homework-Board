import { getAppDayOfWeek, getTodayString, getPromptDateString, formatAppDate } from "@/lib/time";
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
import { PipBubble } from "@/components/PipBubble";
import { normalizePost, type AdminSchedule, type Feedback, type Notification, type Post } from "@/lib/types";

export const revalidate = 30;

type DutyLogRow = { admin_id: string; completed_post: boolean };
type ScheduleRow = AdminSchedule & { profiles: { full_name: string } | null };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const todayStr = getTodayString();
  const dayOfWeek = getAppDayOfWeek();
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
      // Cap the dashboard post list at 100. Without a limit this scans the
      // entire posts table on every render — every visit, every nav,
      // every revalidate. A real homework term could easily exceed this.
      .order("pinned", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
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

  const typedPosts = ((posts ?? []) as Post[]).map(normalizePost);
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
    (p) =>
      p.due_at &&
      p.due_at >= todayStr &&
      !completedSet.has(p.id),
  ).length;
  const overdueCount = typedPosts.filter(
    (p) =>
      p.due_at &&
      p.due_at < todayStr &&
      !completedSet.has(p.id),
  ).length;
  const dueTodayCount = typedPosts.filter(
    (p) => p.due_at === todayStr && !completedSet.has(p.id),
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

  // Pip bubble prompt count
  const { data: pipUsage } = await supabase
    .from("pip_prompts")
    .select("count")
    .eq("user_id", profile.id)
    .eq("prompt_date", getPromptDateString())
    .maybeSingle();
  const pipUsed = (pipUsage as { count?: number } | null)?.count ?? 0;
  const pipRemaining = Math.max(0, 100 - pipUsed);

  const needsAttention = overdueCount + dueTodayCount;
  const subtitle =
    needsAttention > 0
      ? `${formatAppDate(new Date())} · ${needsAttention} ${needsAttention === 1 ? "task" : "tasks"} need attention`
      : `${formatAppDate(new Date())} · nothing overdue or due today`;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle={subtitle}
        showAdminCta
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0">
          <PostsWidget
            posts={sortedPosts}
            completedSet={completedSet}
          />
        </main>

        <aside className="min-w-0 space-y-6">
          <UpcomingWidget posts={sortedPosts} />
          <StatsWidget
            totalPosts={totalPosts}
            completedCount={completedCount}
            upcomingCount={upcomingCount}
            overdueCount={overdueCount}
          />
          <NotificationsWidget
            notifications={(notifications as Notification[]) ?? []}
          />
          <CalendarWidget posts={typedPosts} />
        </aside>
      </div>

      {isAdmin && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DutyWidget
            todaySchedules={todaySchedules}
            completedToday={completedToday}
            todayStr={todayStr}
            currentAdminId={profile.id}
          />
          <FeedbackWidget feedback={feedback} />
        </div>
      )}

      <PipBubble remaining={pipRemaining} />
    </div>
  );
}

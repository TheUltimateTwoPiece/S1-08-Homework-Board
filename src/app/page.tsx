import { getDateAfterDaysString, getPromptDateString, getTodayString, formatAppDate } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { PostsWidget } from "@/components/dashboard/PostsWidget";
import { StatsWidget } from "@/components/dashboard/StatsWidget";
import { NotificationsWidget } from "@/components/dashboard/NotificationsWidget";
import { PipBubble } from "@/components/PipBubble";
import { normalizePost, type Notification, type Post } from "@/lib/types";

export const revalidate = 30;

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const todayStr = getTodayString();
  const tomorrowStr = getDateAfterDaysString(1);

  const [{ data: posts }, { data: completions }, { data: notifications }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("*, profiles(full_name, avatar_url)")
        // Keep the dashboard responsive without hiding recent, relevant work.
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
    ]);

  const typedPosts = ((posts ?? []) as Post[]).map(normalizePost);
  const completedSet = new Set<string>(
    (completions ?? []).map((completion) => completion.post_id as string),
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
  const completedCount = typedPosts.filter((post) => completedSet.has(post.id)).length;
  const assignmentsLeft = Math.max(0, totalPosts - completedCount);
  const dueTodayCount = typedPosts.filter(
    (post) => post.due_at === todayStr && !completedSet.has(post.id),
  ).length;
  const dueTomorrowCount = typedPosts.filter(
    (post) => post.due_at === tomorrowStr && !completedSet.has(post.id),
  ).length;
  const overdueCount = typedPosts.filter(
    (post) =>
      post.due_at &&
      post.due_at < todayStr &&
      !completedSet.has(post.id),
  ).length;

  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  const { data: pipUsage } = await supabase
    .from("pip_prompts")
    .select("count")
    .eq("user_id", profile.id)
    .eq("prompt_date", getPromptDateString())
    .maybeSingle();
  const pipUsed = (pipUsage as { count?: number } | null)?.count ?? 0;
  const pipRemaining = Math.max(0, 100 - pipUsed);

  const subtitle =
    overdueCount > 0
      ? `${formatAppDate(new Date())} · ${overdueCount} overdue`
      : `${formatAppDate(new Date())} · keep an eye on what's due next`;

  return (
    <div className="hb-dashboard-page mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle={subtitle}
        showAdminCta
        showPipCta
      />

      <DashboardSummary
        dueToday={dueTodayCount}
        dueTomorrow={dueTomorrowCount}
        assignmentsLeft={assignmentsLeft}
        overdue={overdueCount}
        completed={completedCount}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PostsWidget posts={sortedPosts} completedSet={completedSet} />

        <aside className="min-w-0 space-y-6">
          <NotificationsWidget
            notifications={(notifications as Notification[]) ?? []}
          />
          <StatsWidget
            totalPosts={totalPosts}
            completedCount={completedCount}
            upcomingCount={assignmentsLeft}
            overdueCount={overdueCount}
          />
        </aside>
      </div>

      <PipBubble remaining={pipRemaining} />
    </div>
  );
}

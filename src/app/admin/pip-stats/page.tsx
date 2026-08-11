import { redirect } from "next/navigation";
import { parseISO } from "date-fns";
import { formatAppDate, formatAppDateTime, getDateAfterDaysString, getTodayString } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";

export const revalidate = 0;
export const dynamic = "force-dynamic";

interface PipUserStats {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  promptsToday: number;
  promptsWeek: number;
  promptsTotal: number;
  chatsCount: number;
  messagesCount: number;
  lastActive: string | null;
  completionRate: number;
}

export default async function AdminPipStatsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const now = new Date();
  const todayStr = getTodayString(now);
  // Seven calendar dates: today plus the six preceding dates.
  const weekAgoStr = getDateAfterDaysString(-6, now);

  // Fetch every Pip user (students and admins) so the overview cards and chart
  // measure the same population. The previous student-only filter excluded
  // prompts made by an admin, even though those prompts were still in the chart.
  const [
    { data: students },
    { data: promptsAll },
    { data: promptsWeek },
    { data: chats },
    { data: messages },
    { data: completions },
    { data: posts },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["student", "admin"])
      .order("full_name"),

    supabase
      .from("pip_prompts")
      .select("user_id, count, last_active_at"),

    supabase
      .from("pip_prompts")
      .select("user_id, count, prompt_date")
      .gte("prompt_date", weekAgoStr),

    supabase
      .from("pip_chats")
      .select("id, user_id, updated_at"),

    supabase
      .from("pip_messages")
      .select("chat_id"),

    supabase
      .from("post_completions")
      .select("user_id"),

    supabase
      .from("posts")
      .select("id"),
  ]);

  const totalPosts = (posts ?? []).length;

  // Build the daySums map FIRST so we can derive today's date from the DB data
  const daySums = new Map<string, number>();
  for (const r of promptsWeek ?? [])
    daySums.set(r.prompt_date, (daySums.get(r.prompt_date) ?? 0) + r.count);

  // Build lookup maps
  const todayMap = new Map<string, number>();
  const weekMap = new Map<string, number>();
  for (const r of promptsWeek ?? []) {
    weekMap.set(r.user_id, (weekMap.get(r.user_id) ?? 0) + r.count);
    if (r.prompt_date === todayStr)
      todayMap.set(r.user_id, (todayMap.get(r.user_id) ?? 0) + r.count);
  }

  const totalMap = new Map<string, number>();
  for (const r of promptsAll ?? [])
    totalMap.set(r.user_id, (totalMap.get(r.user_id) ?? 0) + r.count);

  // Last active: the newest last_active_at stamped across a user's prompt rows.
  // This is the source of truth — it survives chat deletion and failed message
  // saves, which previously made the chats-only updated_at signal stale.
  const lastActiveMap = new Map<string, string>();
  for (const r of promptsAll ?? []) {
    const t = r.last_active_at as string | null;
    if (!t) continue;
    const prev = lastActiveMap.get(r.user_id);
    if (!prev || t > prev) lastActiveMap.set(r.user_id, t);
  }

  const chatsMap = new Map<string, { count: number; lastActive: string | null }>();
  for (const r of chats ?? []) {
    const entry = chatsMap.get(r.user_id);
    const lastActive = r.updated_at as string;
    chatsMap.set(r.user_id, {
      count: entry ? entry.count + 1 : 1,
      lastActive:
        !entry || !entry.lastActive || lastActive > entry.lastActive
          ? lastActive
          : entry.lastActive,
    });
  }

  // Build chat_id -> user_id map for message attribution (from merged chats query)
  const chatOwnerMap = new Map<string, string>();
  for (const r of chats ?? [])
    chatOwnerMap.set(r.id, r.user_id);

  const messagesMap = new Map<string, number>();
  for (const r of messages ?? []) {
    const ownerId = chatOwnerMap.get(r.chat_id);
    if (ownerId)
      messagesMap.set(ownerId, (messagesMap.get(ownerId) ?? 0) + 1);
  }

  const completionsMap = new Map<string, number>();
  for (const r of completions ?? [])
    completionsMap.set(r.user_id, (completionsMap.get(r.user_id) ?? 0) + 1);

  // Build per-user stats
  const userStats: PipUserStats[] = (students ?? []).map((s) => {
    const completed = completionsMap.get(s.id) ?? 0;
    const promptLast = lastActiveMap.get(s.id) ?? null;
    const chatLast = chatsMap.get(s.id)?.lastActive ?? null;
    return {
      userId: s.id,
      fullName: s.full_name ?? "Unknown",
      email: s.email ?? "",
      role: s.role ?? "student",
      promptsToday: todayMap.get(s.id) ?? 0,
      promptsWeek: weekMap.get(s.id) ?? 0,
      promptsTotal: totalMap.get(s.id) ?? 0,
      chatsCount: chatsMap.get(s.id)?.count ?? 0,
      messagesCount: messagesMap.get(s.id) ?? 0,
      // Newest of the two signals: prompt timestamps survive chat deletion,
      // while chat updated_at still captures non-prompt activity like renames.
      lastActive:
        promptLast && (!chatLast || promptLast > chatLast)
          ? promptLast
          : chatLast,
      completionRate: totalPosts > 0 ? Math.round((completed / totalPosts) * 100) : 0,
    };
  });

  // Sort: most active this week first
  userStats.sort((a, b) => b.promptsWeek - a.promptsWeek);

  // Aggregate stats
  const studentStats = userStats.filter((u) => u.role === "student");
  // Overview totals come directly from the same raw prompt rows as the chart.
  // This keeps the card correct even if a prompt's profile is missing or has
  // a role outside the normal student/admin set.
  const totalPromptsToday = daySums.get(todayStr) ?? 0;
  const totalPromptsWeek = (promptsWeek ?? []).reduce((sum, r) => sum + r.count, 0);
  const activeUsersToday = new Set(
    (promptsWeek ?? [])
      .filter((r) => r.prompt_date === todayStr && r.count > 0)
      .map((r) => r.user_id),
  ).size;
  const activeUsersWeek = new Set(
    (promptsWeek ?? [])
      .filter((r) => r.count > 0)
      .map((r) => r.user_id),
  ).size;
  const avgPromptsPerUser = activeUsersWeek > 0
    ? Math.round(totalPromptsWeek / activeUsersWeek)
    : 0;
  const avgStudentCompletion = studentStats.length > 0
    ? Math.round(studentStats.reduce((sum, u) => sum + u.completionRate, 0) / studentStats.length)
    : 0;

  // 7-day chart data: day-by-day prompt counts for the bar chart
  const dayLabels: string[] = [];
  const dayCounts: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = parseISO(getDateAfterDaysString(-i, now));
    dayLabels.push(formatAppDate(d, { weekday: "short" }));
    dayCounts.push(0);
  }

  // Fill chart dayCounts from the shared daySums map
  for (let i = 6; i >= 0; i--) {
    const dateKey = getDateAfterDaysString(-i, now);
    dayCounts[6 - i] = daySums.get(dateKey) ?? 0;
  }

  const maxDayCount = Math.max(1, ...dayCounts);

  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle="Monitor Pip usage, student activity, and progress across the cohort."
        showAdminCta={false}
      />

      {/* Overview cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Prompts today"
          value={totalPromptsToday}
          sub={`${activeUsersToday} active user${activeUsersToday !== 1 ? "s" : ""}`}
          color="blue"
          icon={
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          }
        />
        <StatCard
          label="Prompts this week"
          value={totalPromptsWeek}
          sub={`${activeUsersWeek} active user${activeUsersWeek !== 1 ? "s" : ""}`}
          color="violet"
          icon={
            <path d="M8 2v4M16 2v4M3 10h18M12 14v-4M8 14h8" />
          }
        />
        <StatCard
          label="Avg prompts/user"
          value={avgPromptsPerUser}
          sub="per active user this week"
          color="amber"
          icon={
            <path d="M12 20V10M18 20V4M6 20v-4" />
          }
        />
        <StatCard
          label="Active this week"
          value={activeUsersWeek}
          sub={`of ${userStats.length} Pip users`}
          color="emerald"
          icon={
            <>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </>
          }
        />
        <StatCard
          label="Avg completion"
          value={`${avgStudentCompletion}%`}
          sub="avg across students"
          color="rose"
          icon={
            <>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </>
          }
        />
      </div>

      {/* 7-day usage chart */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="hb-card-section text-base">Prompts — last 7 days</h2>
        <div className="mt-4 grid grid-cols-7 items-end gap-2 sm:gap-3" style={{ height: "180px" }}>
          {dayLabels.map((label, i) => {
            const hPct = (dayCounts[i] / maxDayCount) * 100;
            const isToday = i === 6;
            return (
              <div key={`${label}-${i}`} className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5">
                <span className={`text-xs font-semibold tabular-nums ${
                  dayCounts[i] > 0 ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"
                }`}>
                  {dayCounts[i]}
                </span>
                <div className="flex w-full max-w-[40px] flex-1 items-end">
                  <div
                    className={`w-full rounded-t-md transition-[height] duration-300 ${
                      isToday
                        ? "bg-gradient-to-t from-blue-500 to-blue-400"
                        : dayCounts[i] > 0
                          ? "bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600"
                          : "bg-slate-100 dark:bg-slate-800"
                    }`}
                    style={{ height: dayCounts[i] > 0 ? `${Math.max(hPct, 4)}%` : "0%" }}
                    title={`${label}: ${dayCounts[i]} prompts`}
                  />
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isToday ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                }`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-user table */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="hb-card-section text-base">All Pip users</h2>
          <span className="text-xs text-slate-400">{userStats.length} users</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3 text-center">Today</th>
                <th className="px-5 py-3 text-center">This week</th>
                <th className="px-5 py-3 text-center">Total</th>
                <th className="px-5 py-3 text-center">Chats</th>
                <th className="px-5 py-3 text-center">Messages</th>
                <th className="px-5 py-3 text-center">Completion</th>
                <th className="px-5 py-3 text-right">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {userStats.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No student data yet.
                  </td>
                </tr>
              )}
              {userStats.map((u) => (
                <tr
                  key={u.userId}
                  className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {u.fullName}
                      </div>
                      {u.role === "admin" && (
                        <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.promptsToday > 0
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    }`}>
                      {u.promptsToday}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center tabular-nums font-medium text-slate-700 dark:text-slate-300">
                    {u.promptsWeek}
                  </td>
                  <td className="px-5 py-3 text-center tabular-nums text-slate-600 dark:text-slate-400">
                    {u.promptsTotal}
                  </td>
                  <td className="px-5 py-3 text-center tabular-nums text-slate-600 dark:text-slate-400">
                    {u.chatsCount}
                  </td>
                  <td className="px-5 py-3 text-center tabular-nums text-slate-600 dark:text-slate-400">
                    {u.messagesCount}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Progress bar */}
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            u.completionRate >= 80
                              ? "bg-emerald-500"
                              : u.completionRate >= 50
                                ? "bg-amber-400"
                                : u.completionRate > 0
                                  ? "bg-rose-400"
                                  : "bg-slate-200"
                          }`}
                          style={{ width: `${u.completionRate}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                        {u.completionRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-400">
                    {u.lastActive
                      ? formatAppDateTime(u.lastActive)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** A single overview stat card. */
function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: "blue" | "violet" | "amber" | "emerald" | "rose";
  icon: React.ReactNode;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string; iconText: string }> = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-200",
      iconBg: "bg-blue-100 dark:bg-blue-800/40",
      iconText: "text-blue-600 dark:text-blue-300",
    },
    violet: {
      bg: "bg-violet-50 dark:bg-violet-900/30",
      text: "text-violet-700 dark:text-violet-200",
      iconBg: "bg-violet-100 dark:bg-violet-800/40",
      iconText: "text-violet-600 dark:text-violet-300",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-200",
      iconBg: "bg-amber-100 dark:bg-amber-800/40",
      iconText: "text-amber-600 dark:text-amber-300",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-200",
      iconBg: "bg-emerald-100 dark:bg-emerald-800/40",
      iconText: "text-emerald-600 dark:text-emerald-300",
    },
    rose: {
      bg: "bg-rose-50 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-200",
      iconBg: "bg-rose-100 dark:bg-rose-800/40",
      iconText: "text-rose-600 dark:text-rose-300",
    },
  };
  const c = colorMap[color] ?? colorMap.blue;

  return (
    <div className={`rounded-xl border border-slate-200 p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg} ${c.iconText}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            {icon}
          </svg>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {label}
          </div>
          <div className={`text-xl font-bold tabular-nums tracking-tight ${c.text}`}>
            {value}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { SUBJECTS } from "@/lib/subjects";
import {
  formatPromptDateLabel,
  getPromptDateAfterDaysString,
  getPromptDateString,
} from "@/lib/time";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type CompletionRow = { user_id: string; post_id: string; completed_at: string };
type ViewRow = { user_id: string; last_viewed_at: string; post_id: string };
type PostRow = { id: string; title: string; subject: string[]; due_at: string | null };

export default async function AdminAnalyticsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const now = new Date();
  const todayStr = getPromptDateString(now);

  const [
    { data: profiles },
    { data: posts },
    { data: completions },
    { data: notifications },
    { data: pipPrompts },
    { data: views },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, created_at").in("role", ["student", "admin"]).order("full_name"),
    supabase.from("posts").select("id, title, subject, due_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("post_completions").select("user_id, post_id, completed_at"),
    supabase.from("notifications").select("id, read_at, email_sent_at, email_error"),
    supabase.from("pip_prompts").select("user_id, count, prompt_date"),
    supabase.from("post_views").select("user_id, post_id, last_viewed_at"),
  ]);

  const allProfiles = (profiles as { id: string; full_name: string; role: string; created_at: string }[]) ?? [];
  const students = allProfiles.filter((p) => p.role === "student");
  const typedPosts = (posts as PostRow[] | null) ?? [];
  const typedCompletions = (completions as CompletionRow[] | null) ?? [];
  const typedNotifications = (notifications as { id: string; read_at: string | null; email_sent_at: string | null; email_error: string | null }[] | null) ?? [];
  const typedPrompts = (pipPrompts as { user_id: string; count: number; prompt_date: string }[] | null) ?? [];
  const typedViews = (views as ViewRow[] | null) ?? [];

  const studentIds = new Set(students.map((s) => s.id));
  const completedPostIds = new Set<string>();
  const completionsByDay = new Map<string, number>();
  for (const c of typedCompletions) {
    if (!studentIds.has(c.user_id)) continue;
    completedPostIds.add(c.post_id);
    if (c.completed_at) {
      const day = c.completed_at.slice(0, 10);
      completionsByDay.set(day, (completionsByDay.get(day) ?? 0) + 1);
    }
  }

  // ── Overview ──
  const totalPosts = typedPosts.length;
  const totalStudents = students.length;
  const totalCompletions = typedCompletions.filter((c) => studentIds.has(c.user_id)).length;
  const overallPct = totalPosts > 0 && totalStudents > 0
    ? Math.round((totalCompletions / (totalPosts * totalStudents)) * 100)
    : 0;

  // ── Per-subject bars ──
  const subjectTotal = new Map<string, number>();
  const subjectDone = new Map<string, number>();
  for (const p of typedPosts) {
    const subjects = Array.isArray(p.subject) && p.subject.length > 0 ? p.subject : ["General"];
    for (const s of subjects) {
      subjectTotal.set(s, (subjectTotal.get(s) ?? 0) + 1);
      if (completedPostIds.has(p.id)) subjectDone.set(s, (subjectDone.get(s) ?? 0) + 1);
    }
  }
  const subjectRows = SUBJECTS
    .filter((s) => (subjectTotal.get(s) ?? 0) > 0)
    .map((s) => ({ subject: s, total: subjectTotal.get(s) ?? 0, done: subjectDone.get(s) ?? 0 }));

  // ── Overdue hotspots ──
  const overdue = typedPosts
    .filter((p) => p.due_at && p.due_at < todayStr && !completedPostIds.has(p.id))
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
    .slice(0, 10);

  // ── Idle students (7+ days since any completion or view) ──
  const lastCompletionByUser = new Map<string, string>();
  for (const c of typedCompletions) {
    if (!c.user_id || !c.completed_at) continue;
    const prev = lastCompletionByUser.get(c.user_id);
    if (!prev || c.completed_at > prev) lastCompletionByUser.set(c.user_id, c.completed_at);
  }
  const lastViewByUser = new Map<string, string>();
  for (const v of typedViews) {
    if (!v.user_id || !v.last_viewed_at) continue;
    const prev = lastViewByUser.get(v.user_id);
    if (!prev || v.last_viewed_at > prev) lastViewByUser.set(v.user_id, v.last_viewed_at);
  }
  const cutoff = getPromptDateAfterDaysString(-6, now);
  const idleStudents = students
    .map((s) => {
      const lastCompletion = lastCompletionByUser.get(s.id) ?? "";
      const lastView = lastViewByUser.get(s.id) ?? "";
      const lastActivity = lastCompletion > lastView ? lastCompletion : lastView;
      return { ...s, lastActivity };
    })
    .filter((s) => !s.lastActivity || s.lastActivity < cutoff)
    .sort((a, b) => (a.lastActivity || "0000").localeCompare(b.lastActivity || "0000"))
    .slice(0, 15);

  // ── Reminder stats ──
  const reminderTotal = typedNotifications.length;
  const reminderRead = typedNotifications.filter((n) => n.read_at).length;
  const emailSent = typedNotifications.filter((n) => n.email_sent_at).length;
  const emailFailed = typedNotifications.filter((n) => n.email_error).length;

  // ── Pip usage ──
  const pipTotalToday = typedPrompts
    .filter((r) => r.prompt_date === todayStr)
    .reduce((sum, r) => sum + (r.count ?? 0), 0);
  const pipTotalAll = typedPrompts.reduce((sum, r) => sum + (r.count ?? 0), 0);

  // ── View engagement ──
  const viewsByPost = new Map<string, number>();
  for (const v of typedViews) {
    if (!v.post_id) continue;
    viewsByPost.set(v.post_id, (viewsByPost.get(v.post_id) ?? 0) + 1);
  }
  const lowVisibilityPosts = typedPosts
    .map((p) => ({ ...p, views: viewsByPost.get(p.id) ?? 0 }))
    .sort((a, b) => a.views - b.views)
    .slice(0, 8);

  // ── 14-day completion chart ──
  const chartLabels: string[] = [];
  const chartCounts: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = getPromptDateAfterDaysString(-i, now);
    chartLabels.push(formatPromptDateLabel(day));
    chartCounts.push(completionsByDay.get(day) ?? 0);
  }
  const maxChartCount = Math.max(1, ...chartCounts);

  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle="Cohort completion, subject, reminder, and engagement analytics."
        showAdminCta={false}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={totalStudents} sub="enrolled" color="blue" />
        <StatCard label="Posts" value={totalPosts} sub="total homework" color="violet" />
        <StatCard label="Overall completion" value={`${overallPct}%`} sub={`${totalCompletions} marks total`} color="emerald" />
        <StatCard label="Overdue" value={overdue.length} sub="unfinished & past due" color="rose" />
      </div>

      <Section title="Completion — last 14 days">
        <div className="grid grid-cols-14 items-end gap-1 sm:gap-2" style={{ height: "160px" }}>
          {chartLabels.map((label, i) => {
            const hPct = (chartCounts[i] / maxChartCount) * 100;
            return (
              <div key={`${label}-${i}`} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-slate-500">{chartCounts[i] || ""}</span>
                <div className="flex w-full max-w-[28px] flex-1 items-end">
                  <div
                    className={`w-full rounded-t ${chartCounts[i] > 0 ? "bg-gradient-to-t from-emerald-500 to-emerald-300" : "bg-slate-100 dark:bg-slate-800"}`}
                    style={{ height: chartCounts[i] > 0 ? `${Math.max(hPct, 4)}%` : "2px" }}
                    title={`${label}: ${chartCounts[i]}`}
                  />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-tight text-slate-400">{label}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Completion by subject">
        {subjectRows.length === 0 ? (
          <Empty>No posts yet.</Empty>
        ) : (
          <div className="space-y-3">
            {subjectRows.map((row) => {
              const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
              return (
                <div key={row.subject}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{row.subject}</span>
                    <span className="tabular-nums text-slate-500">{row.done}/{row.total} · {pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Overdue hotspots">
          {overdue.length === 0 ? (
            <Empty>Nothing overdue.</Empty>
          ) : (
            <ul className="space-y-2">
              {overdue.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-900/20">
                  <span className="min-w-0 truncate text-sm font-medium text-rose-800 dark:text-rose-200">{p.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-rose-600 dark:text-rose-300">{p.due_at}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Idle students (7+ days)">
          {idleStudents.length === 0 ? (
            <Empty>Everyone has been active recently.</Empty>
          ) : (
            <ul className="space-y-2">
              {idleStudents.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{s.full_name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{s.lastActivity ? `last active ${s.lastActivity}` : "never active"}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reminders sent" value={reminderTotal} sub={`${reminderRead} read`} color="blue" />
        <StatCard label="Emails sent" value={emailSent} sub={`${emailFailed} failed`} color="amber" />
        <StatCard label="Pip prompts today" value={pipTotalToday} sub={`${pipTotalAll} all time`} color="violet" />
        <StatCard label="Unique viewers" value={new Set(typedViews.filter((v) => v.user_id).map((v) => v.user_id)).size} sub="across all posts" color="emerald" />
      </div>

      <Section title="Lowest-visibility posts">
        {lowVisibilityPosts.length === 0 ? (
          <Empty>No posts yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {lowVisibilityPosts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{p.title}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{p.views} view{p.views === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="hb-card-section mb-4 text-base">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: "blue" | "violet" | "amber" | "emerald" | "rose" }) {
  const map: Record<string, string> = {
    blue: "text-blue-700 dark:text-blue-300",
    violet: "text-violet-700 dark:text-violet-300",
    amber: "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    rose: "text-rose-700 dark:text-rose-300",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${map[color]}`}>{value}</div>
      <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

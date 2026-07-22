import Link from "next/link";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  parseISO,
} from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageTopBar } from "@/components/PageTopBar";
import type { Post } from "@/lib/types";

export const revalidate = 30;

type CompletionRow = {
  post_id: string;
  completed_at: string | null;
};

export default async function YourProgressPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [{ data: posts }, { data: completions }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, subject, due_at, pinned, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("post_completions")
      .select("post_id, completed_at")
      .eq("user_id", profile.id),
  ]);

  const typedPosts = (posts as Post[]) ?? [];
  const typedCompletions = (completions ?? []) as CompletionRow[];

  const completedSet = new Set<string>(
    typedCompletions.map((c) => c.post_id),
  );
  const completionDate = new Map<string, Date>();
  for (const c of typedCompletions) {
    if (c.completed_at) completionDate.set(c.post_id, new Date(c.completed_at));
  }

  const totalPosts = typedPosts.length;
  const completedCount = typedPosts.filter((p) => completedSet.has(p.id)).length;
  // "Upcoming" should only count posts the student hasn't done yet —
  // otherwise an already-completed assignment due next week still shows
  // up as upcoming and inflates the count.
  const upcomingCount = typedPosts.filter(
    (p) =>
      p.due_at &&
      p.due_at >= todayStr &&
      !completedSet.has(p.id),
  ).length;
  const overdueCount = typedPosts.filter(
    (p) => p.due_at && p.due_at < todayStr && !completedSet.has(p.id),
  ).length;
  const todoCount = typedPosts.length - completedCount;

  const pctRaw =
    totalPosts === 0 ? 0 : Math.round((completedCount / totalPosts) * 100);
  const pct = Math.max(0, Math.min(100, pctRaw));

  // Subject breakdown
  const subjectMap = new Map<
    string,
    { total: number; done: number }
  >();
  for (const p of typedPosts) {
    const key = p.subject ?? "General";
    const entry = subjectMap.get(key) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (completedSet.has(p.id)) entry.done += 1;
    subjectMap.set(key, entry);
  }
  const subjectRows = Array.from(subjectMap.entries())
    .map(([subject, { total, done }]) => ({
      subject,
      total,
      done,
      pct: total === 0 ? 0 : Math.round((done / total) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  // Streak: consecutive days where at least one post was marked complete.
  // Allow today as a grace day — if today is empty but yesterday had
  // completions, count starts from yesterday (otherwise breathing-room
  // resets the streak at midnight which reads as "you have no streak").
  const now = new Date();
  const daysWithCompletion = new Set<string>();
  for (const c of typedCompletions) {
    if (!c.completed_at) continue;
    daysWithCompletion.add(format(new Date(c.completed_at), "yyyy-MM-dd"));
  }
  const todayYmd = format(now, "yyyy-MM-dd");
  const streakStartIdx = daysWithCompletion.has(todayYmd) ? 0 : 1;
  let streak = 0;
  for (let i = streakStartIdx; i < 60; i++) {
    const day = format(
      new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    );
    if (daysWithCompletion.has(day)) streak += 1;
    else break;
  }

  // Recent completions (with timestamps), descending. O(n + m) via a Map.
  const postById = new Map<string, Post>(typedPosts.map((p) => [p.id, p]));
  const recentCompletions = typedCompletions
    .filter((c) => c.completed_at !== null)
    .sort(
      (a, b) =>
        new Date(b.completed_at as string).getTime() -
        new Date(a.completed_at as string).getTime(),
    )
    .slice(0, 6)
    .map((c) => {
      const post = postById.get(c.post_id);
      return post ? { post, completedAt: c.completed_at as string } : null;
    })
    .filter((x): x is { post: Post; completedAt: string } => x !== null);

  // Up next: top 5 todo posts by due date (overdue first, then by due_at)
  const upNext = typedPosts
    .filter((p) => !completedSet.has(p.id))
    .sort((a, b) => {
      const aKey = a.due_at ?? "ZZZZ";
      const bKey = b.due_at ?? "ZZZZ";
      return aKey.localeCompare(bKey);
    })
    .slice(0, 6);

  // SVG ring math
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle="Your homework progress at a glance."
        showAdminCta={false}
      />

      {/* ── Hero ───────────────────────────────── */}
      <section className="hb-bento-card mb-6 flex flex-col items-center gap-6 p-8 sm:flex-row sm:gap-10">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <svg viewBox="0 0 160 160" className="hb-progress-ring h-44 w-44" aria-hidden="true">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              strokeWidth="11"
              className="hb-card-faded"
              stroke="currentColor"
              opacity="0.35"
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="url(#hb-progress-grad-lg)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="hb-progress-stroke"
            />
            <defs>
              <linearGradient id="hb-progress-grad-lg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="hb-card-title text-5xl tabular-nums">{pct}</span>
            <span className="hb-card-meta text-sm font-semibold uppercase tracking-wider">
              % done
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <h2 className="hb-card-title text-2xl tracking-tight">
            {completedCount} of {totalPosts} complete
          </h2>
          <p className="hb-card-body text-sm">
            {totalPosts === 0
              ? "Welcome! Once your admin posts homework, you'll see your progress here."
              : todoCount === 0
              ? "Every assignment is done — incredible work!"
              : `${todoCount} assignment${todoCount === 1 ? "" : "s"} left to mark off.`}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
            <StatTile label="Done" value={completedCount} variant="success" />
            <StatTile label="Upcoming" value={upcomingCount} variant="warning" />
            <StatTile label="Overdue" value={overdueCount} variant="danger" />
            <StatTile label="Streak" value={streak} variant="info" suffix={streak === 1 ? "day" : "days"} hint="Resets after 2 idle days" />
          </div>
        </div>
      </section>

      {/* ── Subject breakdown ───────────────── */}
      <section className="hb-bento-card mb-6 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="hb-bento-icon-box" aria-hidden="true">📚</div>
          <div>
            <h3 className="hb-card-section text-base">By subject</h3>
            <p className="hb-card-meta text-xs">Completion percentage per subject</p>
          </div>
        </div>
        {subjectRows.length === 0 ? (
          <p className="hb-card-meta py-8 text-center text-sm">No posts yet.</p>
        ) : (
          <ul className="space-y-3">
            {subjectRows.map((row) => (
              <li key={row.subject}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="hb-card-section text-sm">{row.subject}</span>
                  <span className="hb-card-meta text-xs tabular-nums">
                    {row.done} / {row.total} · {row.pct}%
                  </span>
                </div>
                <div className="hb-bar-track"><div className="hb-bar-fill" style={{["--hb-bar-target" as string]: String(row.pct / 100)}} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Up Next ──────────────────────────── */}
      <section className="hb-bento-card mb-6 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="hb-bento-icon-box"
              style={{
                background:
                  "linear-gradient(135deg, rgba(217,119,6,0.18), rgba(217,119,6,0.04))",
                color: "#b45309",
              }}
              aria-hidden="true"
            >
              ⏳
            </div>
            <div>
              <h3 className="hb-card-section text-base">Up next</h3>
              <p className="hb-card-meta text-xs">Earliest assignments to knock out</p>
            </div>
          </div>
          <Link
            href="/posts"
            className="hb-card-section rounded-md px-3 py-1.5 text-xs transition hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            View all →
          </Link>
        </div>
        {upNext.length === 0 ? (
          <p className="hb-card-meta py-8 text-center text-sm">
            You're completely caught up. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {upNext.map((post) => {
              const due = post.due_at;
              const overdue = due && due < todayStr;
              const daysUntil =
                due === null
                  ? null
                  : differenceInCalendarDays(parseISO(due), new Date());
              return (
                <li key={post.id}>
                  <Link
                    href={`/posts/${post.id}`}
                    className="hb-snippet flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="hb-card-section line-clamp-1 text-sm">
                        {post.title}
                      </div>
                      <div className="hb-card-meta text-xs">{post.subject}</div>
                    </div>
                    <div
                      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${
                        overdue
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                          : daysUntil === 0
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          : "hb-card-meta bg-slate-100"
                      }`}
                    >
                      {overdue
                        ? `Overdue ${Math.abs(daysUntil ?? 0)}d`
                        : daysUntil === 0
                        ? "Today"
                        : due
                        ? `In ${daysUntil}d`
                        : "No due date"}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Recent Completions ──────────────── */}
      <section className="hb-bento-card mb-6 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="hb-bento-icon-box"
            style={{
              background:
                "linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.04))",
              color: "#15803d",
            }}
            aria-hidden="true"
          >
            ✓
          </div>
          <div>
            <h3 className="hb-card-section text-base">Recently completed</h3>
            <p className="hb-card-meta text-xs">Your last handful of wins</p>
          </div>
        </div>
        {recentCompletions.length === 0 ? (
          <p className="hb-card-meta py-8 text-center text-sm">
            Mark a post complete to see it here.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentCompletions.map(({ post, completedAt }) => (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.id}`}
                  className="hb-snippet flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="hb-card-section line-clamp-1 text-sm">
                      {post.title}
                    </div>
                    <div className="hb-card-meta text-xs">{post.subject}</div>
                  </div>
                  <div className="hb-card-meta shrink-0 text-xs">
                    {formatDistanceToNow(new Date(completedAt), { addSuffix: true })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pb-6 text-center">
        <Link
          href="/posts"
          className="hb-action-link hb-card-section inline-flex items-center gap-2 text-sm"
        >
          Back to all homework →
        </Link>
      </div>
    </div>
  );
}

type StatTileProps = {
  label: string;
  value: number;
  variant: "success" | "warning" | "danger" | "info";
  suffix?: string;
  hint?: string;
};

function StatTile({ label, value, variant, suffix, hint }: StatTileProps) {
  const styles: Record<StatTileProps["variant"], string> = {
    success:
      "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning:
      "bg-amber-50 border-amber-200 text-amber-800",
    danger:
      "bg-rose-50 border-rose-200 text-rose-800",
    info:
      "bg-blue-50 border-blue-200 text-blue-800",
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${styles[variant]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {suffix && (
          <span className="text-xs font-medium opacity-80">{suffix}</span>
        )}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] opacity-80">{hint}</div>
      )}
    </div>
  );
}


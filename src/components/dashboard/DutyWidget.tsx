import Link from "next/link";
import { format, parseISO } from "date-fns";
import { markDutyCompleted } from "@/actions/schedule";
import { PendingButton } from "@/components/PendingButton";
import type { AdminSchedule } from "@/lib/types";

type DutyWidgetProps = {
  todaySchedules: (AdminSchedule & { profiles: { full_name: string } | null })[];
  completedToday: string[];
  todayStr: string;
  currentAdminId: string;
};

// React form action requires void return — wrap the action result.
async function submitDutyAction(formData: FormData) {
  "use server";
  await markDutyCompleted(formData);
}

export function DutyWidget({
  todaySchedules,
  completedToday,
  todayStr,
  currentAdminId,
}: DutyWidgetProps) {
  const completedSet = new Set(completedToday);

  if (todaySchedules.length === 0) {
    return (
      <section
        className="hb-bento-card"
        style={{ gridColumn: "span 6", gridRow: "span 1", animationDelay: "360ms" }}
      >
        <div className="hb-bento-head">
          <div className="flex items-center gap-2">
            <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.04))", color: "var(--hb-success)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="m9 16 2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Today&apos;s duty
            </h2>
          </div>
          <Link
            href="/admin/schedule"
            className="text-[11px] font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400"
          >
            Schedule →
          </Link>
        </div>
        <div className="flex h-[calc(100%-44px)] items-center justify-center text-center">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              No admins assigned today
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Assign someone on the schedule page
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="hb-bento-card"
      style={{ gridColumn: "span 6", gridRow: "span 1", animationDelay: "360ms" }}
    >
      <div className="hb-bento-head">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.04))", color: "var(--hb-success)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Today&apos;s duty · {format(parseISO(todayStr), "EEE")}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {completedSet.size}/{todaySchedules.length} completed
            </p>
          </div>
        </div>
        <Link
          href="/admin/schedule"
          className="text-[11px] font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400"
        >
          Schedule →
        </Link>
      </div>
      <ul className="space-y-1.5">
        {todaySchedules.map((s, i) => {
          const done = completedSet.has(s.admin_id);
          const isMe = s.admin_id === currentAdminId;
          return (
            <li
              key={`${s.admin_id}-${i}`}
              className="hb-snippet"
              style={{ animationDelay: `${380 + i * 40}ms` }}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}
              >
                {(s.profiles?.full_name ?? "A").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {s.profiles?.full_name ?? "Admin"}
                  {isMe && (
                    <span className="ml-1.5 text-[10px] font-semibold text-blue-600">you</span>
                  )}
                </div>
                <div className={`text-[11px] font-medium ${done ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {done ? "✓ Posted" : "Pending"}
                </div>
              </div>
              {isMe && (
                <form action={submitDutyAction}>
                  <input type="hidden" name="date" value={todayStr} />
                  <PendingButton
                    type="submit"
                    pendingContent="..."
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                      done
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                    }`}
                  >
                    {done ? "Undo" : "Mark done"}
                  </PendingButton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}


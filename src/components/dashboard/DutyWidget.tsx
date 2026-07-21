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

async function submitDutyAction(formData: FormData) {
  "use server";
  await markDutyCompleted(formData);
}

export function DutyWidget({ todaySchedules, completedToday, todayStr, currentAdminId }: DutyWidgetProps) {
  const completedSet = new Set(completedToday);

  return (
    <section
      className="hb-bento-card hb-bento-card--clickable group relative "
      style={{ gridColumn: "span 6", gridRow: "span 1", animationDelay: "360ms" }}
    >
      <div className="hb-bento-head relative z-[1]">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.04))", color: "#15803d" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="hb-card-section text-sm tracking-tight">
              Today&apos;s duty · {format(parseISO(todayStr), "EEE")}
            </h2>
            <p className="hb-card-body text-xs font-semibold">
              {completedSet.size}/{todaySchedules.length} completed
            </p>
          </div>
        </div>
        <span className="rounded-md px-2 py-1 text-[11px] font-bold text-blue-700 transition group-hover:bg-blue-100">
          Schedule →
        </span>
      </div>

      {todaySchedules.length === 0 ? (
        <div className="flex h-[calc(100%-44px)] items-center justify-center text-center">
          <div>
            <p className="hb-card-section text-sm">No admins assigned today</p>
            <p className="hb-card-meta mt-1 text-xs">Assign someone on the schedule page</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5 pb-5">
          {todaySchedules.map((s, i) => {
            const done = completedSet.has(s.admin_id);
            const isMe = s.admin_id === currentAdminId;
            return (
              <li key={s.admin_id + "-" + i} className="hb-snippet relative z-[3]" style={{ animationDelay: (380 + i * 40) + "ms" }}>
                <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (done ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/60 dark:text-emerald-50" : "bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-50")}>
                  {(s.profiles?.full_name ?? "A").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="hb-card-section line-clamp-1 text-sm">
                    {s.profiles?.full_name ?? "Admin"}
                    {isMe && <span className="ml-1.5 text-[10px] font-bold text-blue-700">you</span>}
                  </div>
                  <div className={"text-[11px] font-bold " + (done ? "text-emerald-700" : "hb-card-meta")}>
                    {done ? "✓ Posted" : "Pending"}
                  </div>
                </div>
                {isMe && (
                  <form action={submitDutyAction} className="relative z-[4]">
                    <input type="hidden" name="date" value={todayStr} />
                    <PendingButton
                      type="submit"
                      pendingContent="..."
                      className={"rounded-md px-2 py-1 text-[11px] font-bold transition " + (done ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60")}
                    >
                      {done ? "Undo" : "Mark done"}
                    </PendingButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/admin/schedule" className="absolute inset-0 z-[1] rounded-[inherit]" tabIndex={-1} aria-hidden="true" aria-label="Open admin schedule" />
    </section>
  );
}

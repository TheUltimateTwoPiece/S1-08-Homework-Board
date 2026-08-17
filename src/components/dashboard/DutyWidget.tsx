import Link from "next/link";
import { markDutyCompleted } from "@/actions/schedule";
import { Avatar } from "@/components/Avatar";
import { PendingButton } from "@/components/PendingButton";
import type { AdminSchedule } from "@/lib/types";
import { formatAppDateOnly } from "@/lib/time";

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

export function DutyWidget({
  todaySchedules,
  completedToday,
  todayStr,
  currentAdminId,
}: DutyWidgetProps) {
  const completedSet = new Set(completedToday);

  return (
    <section aria-labelledby="duty-heading" className="hb-card-surface p-5 sm:p-6">
      <header className="mb-4 flex items-baseline justify-between gap-4 border-b pb-3">
        <div>
          <h2 id="duty-heading" className="hb-card-section text-sm">
            Duty roster · {formatAppDateOnly(todayStr, { weekday: "long" })}
          </h2>
          <p className="hb-card-meta mt-0.5 text-xs">
            {completedSet.size} of {todaySchedules.length} have posted
          </p>
        </div>
        <Link
          href="/admin/schedule"
          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Schedule
        </Link>
      </header>

      {todaySchedules.length === 0 ? (
        <p className="hb-card-meta text-sm">No one is on duty today.</p>
      ) : (
        <ul className="divide-y">
          {todaySchedules.map((s, i) => {
            const done = completedSet.has(s.admin_id);
            const isMe = s.admin_id === currentAdminId;
            return (
              <li key={s.admin_id + "-" + i} className="flex items-center gap-3 py-2.5">
                <Avatar
                  id={s.admin_id}
                  name={s.profiles?.full_name ?? "Admin"}
                  src={s.profiles?.avatar_url ?? null}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="hb-card-section truncate text-sm">
                    {s.profiles?.full_name ?? "Admin"}
                    {isMe && <span className="hb-card-meta ml-1.5 text-xs">(you)</span>}
                  </p>
                  <p
                    className={
                      "text-xs font-medium " +
                      (done
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "hb-card-meta")
                    }
                  >
                    {done ? "Posted" : "Not posted yet"}
                  </p>
                </div>
                {isMe && (
                  <form action={submitDutyAction}>
                    <input type="hidden" name="date" value={todayStr} />
                    <PendingButton
                      type="submit"
                      pendingContent="..."
                      className={
                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition " +
                        (done
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300")
                      }
                    >
                      {done ? "Undo" : "Mark posted"}
                    </PendingButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

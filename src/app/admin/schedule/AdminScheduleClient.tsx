"use client";

import { useActionState, useState } from "react";
import { setAdminSchedule, markDutyCompleted, sendDutyReminders } from "@/actions/schedule";
import type { AdminSchedule } from "@/lib/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AdminScheduleClientProps = {
  schedules: (AdminSchedule & { profiles: { full_name: string } })[];
  admins: { id: string; full_name: string; email: string }[];
  todayStr: string;
  dayOfWeek: number;
  completedToday: string[];
};

export function AdminScheduleClient({
  schedules,
  admins,
  todayStr,
  dayOfWeek,
  completedToday,
}: AdminScheduleClientProps) {
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [selectedDay, setSelectedDay] = useState("");

  const [scheduleState, scheduleAction, schedulePending] = useActionState(
    async (_prev: { error?: string; success?: boolean; label?: string; active?: boolean } | null, formData: FormData) => {
      return setAdminSchedule(formData);
    },
    null,
  );

  const [, dutyAction] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      return markDutyCompleted(formData);
    },
    null,
  );

  const [reminderState, reminderAction, reminderPending] = useActionState(
    async () => {
      return sendDutyReminders();
    },
    null,
  );

  // Build a map: day -> admin_ids scheduled
  const scheduleByDay = new Map<number, Set<string>>();
  for (const s of schedules) {
    if (!s.is_active) continue;
    if (!scheduleByDay.has(s.day_of_week)) scheduleByDay.set(s.day_of_week, new Set());
    scheduleByDay.get(s.day_of_week)!.add(s.admin_id);
  }

  // Find my own schedules
  return (
    <div className="space-y-8">
      {/* Weekly Overview Grid */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-700">Weekly overview</h2>
        <div className="grid grid-cols-7 gap-2">
          {DAY_NAMES.map((name, i) => {
            const assignedAdmins = scheduleByDay.get(i);
            const isToday = i === dayOfWeek;
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 text-center transition ${
                  isToday
                    ? "border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20"
                    : "border-slate-100 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50"
                }`}
              >
                <div className={`text-[10px] font-bold uppercase tracking-wider ${
                  isToday ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-200"
                }`}>
                  {DAYS_SHORT[i]}
                </div>
                <div className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-700">
                  {assignedAdmins ? assignedAdmins.size : 0}
                </div>
                {assignedAdmins && assignedAdmins.size > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {admins
                      .filter((a) => assignedAdmins.has(a.id))
                      .map((a) => (
                        <div key={a.id} className="truncate text-[9px] text-slate-700 dark:text-slate-700">
                          {a.full_name.split(" ")[0]}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Duty */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <h2 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-700">Today&apos;s duty</h2>
        <div className="space-y-3">
          {admins.map((admin) => {
            const assignedToday = scheduleByDay.get(dayOfWeek)?.has(admin.id);
            const done = completedToday.includes(admin.id);

            if (!assignedToday) return null;

            return (
              <div
                key={admin.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/50"
              >
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-700">{admin.full_name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-200">{admin.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold ${done ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {done ? "✓ Completed" : "Pending"}
                  </span>
                  <form action={dutyAction}>
                    <input type="hidden" name="date" value={todayStr} />
                    <input type="hidden" name="completed" value={done ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        done
                          ? "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-700"
                          : "hb-btn-primary px-3 py-1.5 text-xs font-medium"
                      }`}
                    >
                      {done ? "Undo" : "Mark done"}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}

          {admins.filter((a) => scheduleByDay.get(dayOfWeek)?.has(a.id)).length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-200">No admins scheduled for today.</p>
          )}
        </div>
      </div>

      {/* Assign Admins to Days */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-700">Manage assignments</h2>
        <form action={scheduleAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="adminId" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200">Admin</label>
              <select
                id="adminId"
                name="adminId"
                value={selectedAdmin}
                onChange={(e) => setSelectedAdmin(e.target.value)}
                required
                className="hb-input w-full rounded-lg px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="">Select an admin</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>{admin.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dayOfWeek" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200">Day of week</label>
              <select
                id="dayOfWeek"
                name="dayOfWeek"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                required
                className="hb-input w-full rounded-lg px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="">Select a day</option>
                {DAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Active
            </label>
          </div>

          {scheduleState?.error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{scheduleState.error}</div>
          )}
          {scheduleState?.success && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              {scheduleState.active
                ? `${scheduleState.label} assigned!`
                : `${scheduleState.label} assignment removed.`}
            </div>
          )}

          <button
            type="submit"
            disabled={schedulePending || !selectedAdmin || !selectedDay}
            className={`hb-btn-primary gap-2 px-4 py-2 text-sm font-medium ${schedulePending ? "hb-btn--pending" : ""}`}
          >
            {schedulePending && <span className="hb-spinner" aria-hidden="true" />}
            Save assignment
          </button>
        </form>
      </div>

      {/* Send Reminders */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <h2 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-700">Send duty reminders</h2>
        <p className="mb-4 text-sm text-slate-700 dark:text-slate-700">
          Send a reminder to all admins scheduled for today who haven&apos;t marked their post as complete.
        </p>

        <form action={reminderAction}>
          {reminderState?.error && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{reminderState.error}</div>
          )}
          {reminderState?.success && (
            <div className="mb-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              {reminderState.message}
            </div>
          )}
          <button
            type="submit"
            disabled={reminderPending}
            className={`flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600 ${reminderPending ? "opacity-70" : ""}`}
          >
            {reminderPending && <span className="hb-spinner border-white/30 border-t-white" aria-hidden="true" />}
            {reminderPending ? "Sending..." : "Send reminders"}
          </button>
        </form>
      </div>
    </div>
  );
}

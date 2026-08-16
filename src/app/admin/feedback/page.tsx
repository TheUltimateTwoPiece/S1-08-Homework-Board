import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { PendingButton } from "@/components/PendingButton";
import { setFeedbackStatus } from "@/actions/inbox";
import type { Feedback } from "@/lib/types";
import { formatAppDateTime } from "@/lib/time";

export const revalidate = 30;

async function applyFeedbackStatus(formData: FormData) {
  "use server";
  await setFeedbackStatus(formData);
}

export default async function AdminFeedbackPage() {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: feedback } = await supabase
    .from("feedback")
    .select("*, profiles(full_name, email, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(200);

  const typedFeedback = (feedback as Feedback[]) ?? [];
  const postFeedback = typedFeedback.filter((item) => item.category === "post");
  const websiteFeedback = typedFeedback.filter(
    (item) => item.category !== "post",
  );

  function renderItems(items: Feedback[]) {
    if (items.length === 0) {
      return (
        <div className="hb-empty-state flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 text-center dark:border-stone-700">
          <p className="hb-section-title text-sm">No feedback yet.</p>
        </div>
      );
    }

    return (
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="hb-card-surface rounded-xl border p-5 transition hover:shadow-md">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Avatar
                    id={item.author_id}
                    name={item.profiles?.full_name ?? "Student"}
                    src={item.profiles?.avatar_url ?? null}
                    size="sm"
                  />
                  <div className="hb-card-section text-sm">
                    {item.profiles?.full_name ?? "Student"}
                  </div>
                </div>
                {item.profiles?.email && (
                  <div className="hb-card-meta mt-0.5 pl-9 text-xs">{item.profiles.email}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {(() => {
                  const status = item.status ?? "unread";
                  const nextStatus = status === "unread" ? "read" : status === "read" ? "resolved" : "unread";
                  const nextLabel = status === "unread" ? "Mark read" : status === "read" ? "Resolve" : "Reopen";
                  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
                  return (
                    <>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                        status === "unread"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          : status === "resolved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}>
                        {statusLabel}
                      </span>
                      <form action={applyFeedbackStatus} className="flex items-center">
                        <input type="hidden" name="feedbackId" value={item.id} />
                        <input type="hidden" name="status" value={nextStatus} />
                        <PendingButton
                          type="submit"
                          pendingContent="Saving..."
                          className="hb-card-meta rounded-md px-2 py-1 text-[10px] transition hover:bg-slate-100 dark:hover:bg-stone-700/50"
                        >
                          {nextLabel}
                        </PendingButton>
                      </form>
                    </>
                  );
                })()}
                <time className="hb-card-meta shrink-0 text-xs" dateTime={item.created_at}>
                  {formatAppDateTime(item.created_at)}
                </time>
              </div>
            </div>
            <p className="hb-card-body whitespace-pre-line text-sm leading-relaxed">
              {item.message}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm dark:from-amber-900/40 dark:to-orange-900/30">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-amber-600 dark:text-amber-300" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="hb-page-title text-2xl tracking-tight">Feedback inbox</h1>
            <p className="hb-body-text mt-0.5 text-sm">
              Review feedback and move items from unread to resolved.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="hb-section-title text-base">Posts</h2>
            <span className="hb-card-meta rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-stone-700/40">{postFeedback.length}</span>
          </div>
          {renderItems(postFeedback)}
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="hb-section-title text-base">Website</h2>
            <span className="hb-card-meta rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-stone-700/40">{websiteFeedback.length}</span>
          </div>
          {renderItems(websiteFeedback)}
        </section>
      </div>
    </div>
  );
}

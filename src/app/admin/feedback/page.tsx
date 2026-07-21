import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import type { Feedback } from "@/lib/types";

export const revalidate = 30;

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
        <div className="hb-empty-state flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
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
              <time className="hb-card-meta shrink-0 text-xs" dateTime={item.created_at}>
                {new Date(item.created_at).toLocaleString()}
              </time>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-amber-600" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="hb-page-title text-2xl tracking-tight">Feedback</h1>
            <p className="hb-body-text mt-0.5 text-sm">
              Messages submitted from the homepage feedback button.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="hb-section-title text-base">Posts</h2>
            <span className="hb-card-meta rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">{postFeedback.length}</span>
          </div>
          {renderItems(postFeedback)}
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="hb-section-title text-base">Website</h2>
            <span className="hb-card-meta rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">{websiteFeedback.length}</span>
          </div>
          {renderItems(websiteFeedback)}
        </section>
      </div>
    </div>
  );
}

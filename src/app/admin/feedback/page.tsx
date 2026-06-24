import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
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
    .select("*, profiles(full_name, email)")
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
        <div className="hb-card border-dashed p-8 text-center">
          <p className="hb-text-muted">No feedback yet.</p>
        </div>
      );
    }

    return (
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="hb-card p-5">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="hb-text font-semibold">
                  {item.profiles?.full_name ?? "Student"}
                </div>
                {item.profiles?.email && (
                  <div className="hb-text-subtle text-xs">{item.profiles.email}</div>
                )}
              </div>
              <time className="hb-text-subtle shrink-0 text-xs" dateTime={item.created_at}>
                {new Date(item.created_at).toLocaleString()}
              </time>
            </div>
            <p className="hb-text-muted whitespace-pre-line text-sm leading-relaxed">
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
        <h1 className="hb-text text-2xl font-bold">Feedback</h1>
        <p className="hb-text-muted mt-1 text-sm">
          Messages submitted from the homepage feedback button.
        </p>
      </div>

      <div className="space-y-10">
        <section>
          <h2 className="hb-text mb-3 text-lg font-semibold">Posts</h2>
          {renderItems(postFeedback)}
        </section>

        <section>
          <h2 className="hb-text mb-3 text-lg font-semibold">Website</h2>
          {renderItems(websiteFeedback)}
        </section>
      </div>
    </div>
  );
}

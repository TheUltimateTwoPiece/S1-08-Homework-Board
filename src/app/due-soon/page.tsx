import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { PostCard } from "@/components/PostCard";
import { normalizePost, type Post } from "@/lib/types";
import { buildDueSoon, type SubjectGroup } from "@/lib/due-soon";

export const revalidate = 30;

export default async function DueSoonPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: posts }, { data: completions }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, profiles(full_name, avatar_url)")
      .order("pinned", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("post_completions")
      .select("post_id")
      .eq("user_id", profile.id),
  ]);

  const typedPosts = ((posts ?? []) as Post[]).map(normalizePost);
  const completedSet = new Set<string>(
    (completions ?? []).map((c) => c.post_id as string),
  );

  const dueSoon = buildDueSoon(
    typedPosts
      .filter((p): p is Post & { due_at: string } => Boolean(p.due_at))
      .map((p) => ({
        id: p.id,
        title: p.title,
        subject: p.subject,
        due_at: p.due_at!,
        pinned: p.pinned,
      })),
    completedSet,
  );

  const postById = new Map(typedPosts.map((p) => [p.id, p]));
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;
  const total = dueSoon.todayCount + dueSoon.tomorrowCount;

  function renderBucket(groups: SubjectGroup[], bucketLabel: string) {
    if (groups.length === 0) return null;
    return (
      <div>
        {groups.map((group) => (
          <div key={group.subject} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="hb-section-title text-base">{group.subject}</h2>
              <span className="hb-card-meta rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-slate-800">
                {group.posts.length}
              </span>
              <span className="hb-muted-text text-[11px]">
                · {bucketLabel}
              </span>
            </div>
            <div className="space-y-4">
              {group.posts.map((duePost) => {
                const post = postById.get(duePost.id);
                if (!post) return null;
                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    completed={completedSet.has(post.id)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle={`${total} thing${total === 1 ? "" : "s"} to finish in the next two days.`}
      />

      {total === 0 ? (
        <div className="hb-empty-state flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-emerald-600" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="hb-section-title text-sm">Nothing due today or tomorrow</p>
          <p className="hb-muted-text mt-1 text-xs">
            You're all caught up. Enjoy the breathing room.
          </p>
          <Link
            href="/posts"
            className="button mt-6 gap-2"
          >
            Browse all homework
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {dueSoon.today.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-amber-600" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h1 className="hb-page-title text-xl tracking-tight">Due today</h1>
                  <p className="hb-muted-text text-xs">
                    {dueSoon.todayCount} to finish
                  </p>
                </div>
              </div>
              {renderBucket(dueSoon.today, "due today")}
            </section>
          )}

          {dueSoon.tomorrow.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-blue-600" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <h1 className="hb-page-title text-xl tracking-tight">Due tomorrow</h1>
                  <p className="hb-muted-text text-xs">
                    {dueSoon.tomorrowCount} to finish
                  </p>
                </div>
              </div>
              {renderBucket(dueSoon.tomorrow, "due tomorrow")}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

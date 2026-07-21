import Link from "next/link";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { PostFiltersBar } from "@/components/PostFiltersBar";
import { PageTopBar } from "@/components/PageTopBar";
import { requireProfile } from "@/lib/auth";
import type { Post } from "@/lib/types";

export const revalidate = 30;

type PostsPageProps = {
  searchParams?: Promise<{
    q?: string;
    subject?: string;
    status?: string;
    due?: string;
  }>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const params = searchParams ? await searchParams : {};
  const profile = await requireProfile();
  const supabase = await createClient();

  const q = (params.q ?? "").trim().slice(0, 100);
  const subject = (params.subject ?? "").trim();
  const status = (params.status ?? "all").trim();
  const due = (params.due ?? "all").trim();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

  let postsQuery = supabase
    .from("posts")
    .select("*, profiles(full_name)")
    .order("pinned", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (q) {
    const qSafe = q.replace(/[,]/g, " ");
    postsQuery = postsQuery.or(
      `title.ilike.%${qSafe}%,content.ilike.%${qSafe}%`,
    );
  }

  if (subject) {
    postsQuery = postsQuery.eq("subject", subject);
  }

  if (due !== "all") {
    postsQuery = postsQuery.not("due_at", "is", null);

    if (due === "today") postsQuery = postsQuery.eq("due_at", todayStr);
    if (due === "tomorrow") postsQuery = postsQuery.eq("due_at", tomorrowStr);
    if (due === "overdue") postsQuery = postsQuery.lt("due_at", todayStr);
    if (due === "upcoming") postsQuery = postsQuery.gt("due_at", todayStr);
  }

  const { data: posts } = await postsQuery;
  const { data: completions } = await supabase
    .from("post_completions")
    .select("post_id")
    .eq("user_id", profile.id);

  const completedPostIds = new Set(
    completions?.map((completion) => completion.post_id) ?? [],
  );

  const typedPosts = (posts as Post[]) ?? [];

  const sortedPosts = [...typedPosts].sort((a, b) => {
    const aDone = completedPostIds.has(a.id) ? 1 : 0;
    const bDone = completedPostIds.has(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.due_at !== b.due_at) {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filteredPosts = sortedPosts.filter((post) => {
    const isCompleted = completedPostIds.has(post.id);
    if (status === "completed") return isCompleted;
    if (status === "todo") return !isCompleted;
    return true;
  });

  const subjects = ["General", "Math", "Science", "English", "History", "Language"];
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle={`${filteredPosts.length} homework post${filteredPosts.length === 1 ? "" : "s"} · sorted by completion + due date`}
        showAdminCta
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-700" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5" />
            <path d="M9 10h6" />
            <path d="M9 14h6" />
          </svg>
        </div>
        <h1 className="hb-page-title text-2xl tracking-tight">
          Daily Homework
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/feedback"
            className="hb-section-title flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback
          </Link>
        </div>
      </div>

      <PostFiltersBar subjects={subjects} />

      <div className="hb-muted-text mt-4 flex items-center justify-between text-xs">
        <span>
          {filteredPosts.length} match
          {filteredPosts.length === 1 ? "" : "es"}
        </span>
        <span className="hidden sm:inline">
          Uncompleted always on top · mark done as you go
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="hb-empty-state flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="hb-muted-text h-7 w-7" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <p className="hb-section-title text-sm">
              No homework matches these filters
            </p>
            <p className="hb-muted-text mt-1 text-xs">
              Try adjusting your search or filter criteria
            </p>
            {profile.role === "admin" && (
              <Link href="/admin" className="hb-btn-primary mt-6 gap-2 px-4 py-2 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Create your first post
              </Link>
            )}
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              completed={completedPostIds.has(post.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

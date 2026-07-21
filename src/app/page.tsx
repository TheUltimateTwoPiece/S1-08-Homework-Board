import Link from "next/link";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { PostFiltersBar } from "@/components/PostFiltersBar";
import { requireProfile } from "@/lib/auth";
import type { Post } from "@/lib/types";

export const revalidate = 30;

type HomePageProps = {
  searchParams: Promise<{
    q?: string;
    subject?: string;
    status?: string;
    due?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
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

  const [{ data: posts }, { data: completions }] = await Promise.all([
    postsQuery,
    supabase
      .from("post_completions")
      .select("post_id")
      .eq("user_id", profile.id),
  ]);

  const completedPostIds = new Set(
    completions?.map((completion) => completion.post_id) ?? [],
  );

  const typedPosts = (posts as Post[]) ?? [];
  const filteredPosts = typedPosts.filter((post) => {
    const isCompleted = completedPostIds.has(post.id);
    if (status === "completed") return isCompleted;
    if (status === "todo") return !isCompleted;
    return true;
  });

  const subjects = ["General", "Math", "Science", "English", "History", "Language"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Homework</h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
              {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Welcome back, <span className="font-medium text-slate-700">{profile.full_name}</span>. Here are the latest assignments.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/feedback" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback
          </Link>
          {profile.role === "admin" && (
            <Link href="/admin" className="hb-btn-primary gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              New post
            </Link>
          )}
        </div>
      </div>

      <PostFiltersBar subjects={subjects} />

      {filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              completed={completedPostIds.has(post.id)}
            />
          ))}
        </div>
      ) : (
        <div className="hb-empty-state flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-slate-400" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600">No homework matches these filters</p>
          <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filter criteria</p>
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
      )}
    </div>
  );
}

import Link from "next/link";
import { getDateAfterDaysString, getTodayString } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { PostFiltersBar } from "@/components/PostFiltersBar";
import { PageTopBar } from "@/components/PageTopBar";
import { requireProfile } from "@/lib/auth";
import { SUBJECTS } from "@/lib/subjects";
import { normalizePost, type Post } from "@/lib/types";
import { getDueState } from "@/lib/due";

export const revalidate = 30;

function sanitizeSearchTerm(value: string): string {
  // PostgREST's `.or()` grammar uses punctuation as operators, while `%` and
  // `_` are LIKE wildcards. Keep search input to letters, numbers, spaces,
  // and hyphens so a query cannot break the filter expression or broaden it
  // into an unintended wildcard search.
  return value
    .replace(/[^\p{L}\p{N} -]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

  const q = sanitizeSearchTerm((params.q ?? "").trim().slice(0, 100));
  const subject = (params.subject ?? "").trim();
  const status = (params.status ?? "all").trim();
  const due = (params.due ?? "all").trim();

  const todayStr = getTodayString();
  const tomorrowStr = getDateAfterDaysString(1);

  let postsQuery = supabase
    .from("posts")
    .select("*, profiles(full_name, avatar_url)")
    // Cap the posts list at 200. Without a limit this scans the entire
    // posts table on every render of /posts. A real homework term easily
    // exceeds this.
    .order("pinned", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    postsQuery = postsQuery.or(
      `title.ilike.%${q}%,content.ilike.%${q}%`,
    );
  }

  if (subject) {
    postsQuery = postsQuery.contains("subject", [subject]);
  }

  if (due !== "all") {
    postsQuery = postsQuery.not("due_at", "is", null);

    if (due === "today") postsQuery = postsQuery.eq("due_at", todayStr);
    if (due === "tomorrow") postsQuery = postsQuery.eq("due_at", tomorrowStr);
    if (due === "overdue") postsQuery = postsQuery.lte("due_at", todayStr);
    if (due === "upcoming") postsQuery = postsQuery.gte("due_at", todayStr);
  }

  // Run the posts query and the completion lookup in parallel — they have
  // no dependency on each other.
  const [{ data: posts }, { data: completions }] = await Promise.all([
    postsQuery,
    supabase
      .from("post_completions")
      .select("post_id")
      .eq("user_id", profile.id),
  ]);

  const completedPostIds = new Set(
    completions?.map((completion) => completion.post_id as string) ?? [],
  );

  const typedPosts = ((posts ?? []) as Post[]).map(normalizePost);

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
    if (a.due_time !== b.due_time) {
      if (!a.due_time) return 1;
      if (!b.due_time) return -1;
      return a.due_time.localeCompare(b.due_time);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filteredPosts = sortedPosts.filter((post) => {
    const isCompleted = completedPostIds.has(post.id);
    if (status === "completed" && !isCompleted) return false;
    if (status === "todo" && isCompleted) return false;
    if (due !== "all") {
      const dueKind = getDueState(post.due_at, post.due_time)?.kind;
      if (due === "today" && dueKind !== "today") return false;
      if (due === "tomorrow" && dueKind !== "tomorrow") return false;
      if (due === "overdue" && dueKind !== "overdue") return false;
      if (due === "upcoming" && (!dueKind || dueKind === "overdue")) return false;
    }
    return true;
  });

  // Subjects come from the shared SRC/lib/subjects constant; no inline copy.
  // The filter dropdown renders one option per entry in SUBJECTS via PostFiltersBar.
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle={`${filteredPosts.length} homework post${filteredPosts.length === 1 ? "" : "s"} · sorted by completion + due date`}
        showAdminCta
      />

      <div className="mb-4 flex items-end justify-between gap-3 border-b pb-3">
        <h1 className="hb-page-title text-2xl tracking-tight">
          Daily homework
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/feedback"
            className="hb-section-title flex items-center gap-1.5 px-2 py-1 text-sm transition hover:text-blue-600 dark:hover:text-blue-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback
          </Link>
        </div>
      </div>

      <PostFiltersBar subjects={SUBJECTS} />

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
          <div className="hb-empty-state flex flex-col items-center justify-center border-y border-dashed border-[var(--hb-border)] py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center border border-[var(--hb-border)] text-[var(--hb-text-muted)]">
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
              <Link href="/admin" className="button mt-6 gap-2">
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

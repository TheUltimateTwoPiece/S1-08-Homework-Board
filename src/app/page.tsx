import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { requireProfile } from "@/lib/auth";
import type { Post } from "@/lib/types";
import { unstable_cache } from "next/cache";

export const revalidate = 30;

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const getCachedPosts = unstable_cache(
    async () => {
      return await supabase
        .from("posts")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false });
    },
    ["posts"],
    { revalidate: 30, tags: ["posts"] }
  );

  const getCachedCompletions = unstable_cache(
    async (userId: string) => {
      return await supabase
        .from("post_completions")
        .select("post_id")
        .eq("user_id", userId);
    },
    ["completions"],
    { revalidate: 30, tags: ["completions"] }
  );

  const [{ data: posts }, { data: completions }] = await Promise.all([
    getCachedPosts(),
    getCachedCompletions(profile.id),
  ]);

  const completedPostIds = new Set(
    completions?.map((completion) => completion.post_id) ?? [],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Daily Homework</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome back, {profile.full_name}. Here are the latest assignments.
        </p>
      </div>

      {posts && posts.length > 0 ? (
        <div className="space-y-4">
          {(posts as Post[]).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              completed={completedPostIds.has(post.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">No homework posted yet.</p>
          {profile.role === "admin" && (
            <p className="mt-2 text-sm text-slate-500">
              Head to the{" "}
              <a href="/admin" className="font-medium text-indigo-600 hover:underline">
                admin panel
              </a>{" "}
              to create your first post.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

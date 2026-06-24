import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { requireProfile } from "@/lib/auth";
import type { Post } from "@/lib/types";

export const revalidate = 30;

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: posts }, { data: completions }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("post_completions")
      .select("post_id")
      .eq("user_id", profile.id),
  ]);

  const completedPostIds = new Set(
    completions?.map((completion) => completion.post_id) ?? [],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="hb-text text-2xl font-bold">Daily Homework</h1>
        <p className="hb-text-muted mt-1 text-sm">
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
        <div className="hb-card border-dashed p-12 text-center">
          <p className="hb-text-muted">No homework posted yet.</p>
          {profile.role === "admin" && (
            <p className="hb-text-subtle mt-2 text-sm">
              Head to the{" "}
              <a href="/admin" className="hb-link font-medium">
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { CommentForm } from "@/components/CommentForm";
import { CommentList } from "@/components/CommentList";
import { PostCompleteCheckbox } from "@/components/PostCompleteCheckbox";
import { deletePost } from "@/actions/posts";
import type { Comment, Post } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 30;

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: post }, { data: comments }, { data: completion }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, profiles(full_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("comments")
      .select("*, profiles(full_name)")
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("post_completions")
      .select("id")
      .eq("post_id", id)
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  if (!post) notFound();

  const typedPost = post as Post;
  const isCompleted = Boolean(completion);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="hb-link mb-6 inline-block text-sm"
      >
        ← Back to all posts
      </Link>

      <article
        className={`hb-card p-6 ${isCompleted ? "hb-card--completed" : ""}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <PostCompleteCheckbox
              postId={typedPost.id}
              completed={isCompleted}
            />
            <h1
              className={`text-2xl font-bold ${
                isCompleted ? "hb-text-subtle line-through" : "hb-text"
              }`}
            >
              {typedPost.title}
            </h1>
          </div>
          {profile.role === "admin" && (
            <form action={deletePost}>
              <input type="hidden" name="postId" value={typedPost.id} />
              <button
                type="submit"
                className="hb-text-error text-sm hover:underline"
              >
                Delete post
              </button>
            </form>
          )}
        </div>

        <div className="hb-text-subtle mb-6 flex gap-3 text-xs">
          <span>{typedPost.profiles?.full_name ?? "Admin"}</span>
          <span>·</span>
          <time dateTime={typedPost.created_at}>
            {format(new Date(typedPost.created_at), "MMMM d, yyyy 'at' h:mm a")}
          </time>
        </div>

        <div className="hb-text-muted whitespace-pre-line text-sm leading-relaxed">
          {typedPost.content}
        </div>
      </article>

      <section className="mt-8">
        <h2 className="hb-text mb-4 text-lg font-semibold">
          Comments ({comments?.length ?? 0})
        </h2>

        <div className="mb-6">
          <CommentForm postId={id} />
        </div>

        <CommentList
          comments={(comments as Comment[]) ?? []}
          currentUserId={profile.id}
        />
      </section>
    </div>
  );
}

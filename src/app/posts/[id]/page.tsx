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
        className="mb-6 inline-block text-sm text-indigo-600 hover:underline"
      >
        ← Back to all posts
      </Link>

      <article
        className={`rounded-xl border bg-white p-6 shadow-sm ${
          isCompleted ? "border-green-200 bg-green-50/40" : "border-slate-200"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <PostCompleteCheckbox
              postId={typedPost.id}
              completed={isCompleted}
            />
            <h1
              className={`text-2xl font-bold ${
                isCompleted ? "text-slate-500 line-through" : "text-slate-900"
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
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete post
              </button>
            </form>
          )}
        </div>

        <div className="mb-6 flex gap-3 text-xs text-slate-500">
          <span>{typedPost.profiles?.full_name ?? "Admin"}</span>
          <span>·</span>
          <time dateTime={typedPost.created_at}>
            {format(new Date(typedPost.created_at), "MMMM d, yyyy 'at' h:mm a")}
          </time>
        </div>

        <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {typedPost.content}
        </div>
      </article>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
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

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PostCompleteCheckbox } from "@/components/PostCompleteCheckbox";
import type { Post } from "@/lib/types";

type PostCardProps = {
  post: Post;
  completed: boolean;
};

export function PostCard({ post, completed }: PostCardProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border bg-white p-5 shadow-sm transition ${
        completed
          ? "border-green-200 bg-green-50/40"
          : "border-slate-200 hover:border-indigo-300 hover:shadow-md"
      }`}
    >
      <PostCompleteCheckbox postId={post.id} completed={completed} compact />

      <Link href={`/posts/${post.id}`} className="min-w-0 flex-1">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h2
            className={`text-lg font-semibold ${
              completed ? "text-slate-500 line-through" : "text-slate-900"
            }`}
          >
            {post.title}
          </h2>
          <time
            className="shrink-0 text-xs text-slate-500"
            dateTime={post.created_at}
          >
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>
        <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {post.content}
        </p>
        {post.profiles?.full_name && (
          <p className="mt-3 text-xs text-slate-400">
            Posted by {post.profiles.full_name}
          </p>
        )}
      </Link>
    </div>
  );
}

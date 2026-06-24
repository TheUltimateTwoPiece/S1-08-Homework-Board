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
      className={`hb-card flex items-start gap-3 p-5 hb-card--interactive ${
        completed
          ? "hb-card--completed"
          : ""
      }`}
    >
      <PostCompleteCheckbox postId={post.id} completed={completed} compact />

      <Link href={`/posts/${post.id}`} className="min-w-0 flex-1">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h2
            className={`text-lg font-semibold ${
              completed ? "hb-text-subtle line-through" : "hb-text"
            }`}
          >
            {post.title}
          </h2>
          <time
            className="hb-text-subtle shrink-0 text-xs"
            dateTime={post.created_at}
          >
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>
        <p className="hb-text-muted line-clamp-3 whitespace-pre-line text-sm leading-relaxed">
          {post.content}
        </p>
        {post.profiles?.full_name && (
          <p className="hb-text-subtle mt-3 text-xs">
            Posted by {post.profiles.full_name}
          </p>
        )}
      </Link>
    </div>
  );
}

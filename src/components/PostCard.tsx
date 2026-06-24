import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PostCompleteCheckbox } from "@/components/PostCompleteCheckbox";
import { getDueBadge } from "@/lib/due";
import type { Post } from "@/lib/types";

type PostCardProps = {
  post: Post;
  completed: boolean;
};

export function PostCard({ post, completed }: PostCardProps) {
  const dueBadge = getDueBadge(post.due_at);
  const wasEdited =
    new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() >
    60 * 1000;

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
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {post.pinned && (
                <span className="hb-badge-new rounded px-2 py-0.5 text-[10px] font-semibold">
                  Pinned
                </span>
              )}
              <span className="hb-text-subtle text-[10px] font-semibold uppercase tracking-wide">
                {post.subject}
              </span>
              {dueBadge && (
                <span className={`${dueBadge.className} text-[10px] font-semibold`}>
                  {dueBadge.label}
                </span>
              )}
              {wasEdited && (
                <span className="hb-text-subtle text-[10px] font-semibold">
                  Edited
                </span>
              )}
            </div>
            <h2
              className={`text-lg font-semibold ${
                completed ? "hb-text-subtle line-through" : "hb-text"
              }`}
            >
              {post.title}
            </h2>
          </div>
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
